using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SilentInterview.Application.DTOs.Auth;
using SilentInterview.Application.Interfaces;
using SilentInterview.Application.Settings;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly JwtSettings _jwtSettings;

    public AuthService(
        SilentInterviewDbContext context,
        IJwtService jwtService,
        IOptions<JwtSettings> jwtOptions)
    {
        _context = context;
        _jwtService = jwtService;
        _jwtSettings = jwtOptions.Value;
    }

    #region Register

public async Task<bool> RegisterAsync(RegisterRequest request)
{
    var email = request.Email.Trim().ToLower();

    var exists = await _context.Users
        .AnyAsync(x => x.Email == email);

    if (exists)
        return false;

    if (!Enum.TryParse<Role>(request.Role, true, out var requestedRole) ||
        requestedRole is not (Role.Candidate or Role.Recruiter))
        return false;

    var user = new User
    {
        Id = Guid.NewGuid(),
        FullName = request.FullName.Trim(),
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        Role = requestedRole,
        EmailConfirmed = false,
        IsActive = true
    };

    await _context.Users.AddAsync(user);

    if (requestedRole == Role.Candidate)
    {
        await _context.Candidates.AddAsync(new Candidate
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            ResumeUrl = "",
            Skills = "",
            Education = "",
            Experience = ""
        });
    }
    else if (requestedRole == Role.Recruiter)
    {
        // A recruiter must choose the workspace during signup. Never create a
        // fake "John's Company" record just because the user skipped setup.
        if (!request.CompanyId.HasValue && string.IsNullOrWhiteSpace(request.CompanyName))
            return false;

        Guid companyId;
        if (request.CompanyId.HasValue)
        {
            var selected = await _context.Companies
                .FirstOrDefaultAsync(c => c.Id == request.CompanyId.Value && !c.IsDeleted);
            if (selected == null) return false;
            companyId = selected.Id;
        }
        else
        {
            var normalized = request.CompanyName!.Trim();
            var existing = await _context.Companies
                .FirstOrDefaultAsync(c => c.Name.ToLower() == normalized.ToLower() && !c.IsDeleted);

            if (existing != null)
            {
                companyId = existing.Id;
            }
            else
            {
                var company = new Company
                {
                    Id = Guid.NewGuid(),
                    Name = normalized,
                    Industry = string.IsNullOrWhiteSpace(request.CompanyIndustry) ? "General" : request.CompanyIndustry.Trim(),
                    CountryCode = request.CompanyCountry?.Trim().ToUpperInvariant() ?? "",
                    Website = string.IsNullOrWhiteSpace(request.CompanyWebsite) ? "" : request.CompanyWebsite.Trim(),
                    Description = string.IsNullOrWhiteSpace(request.CompanyCountry) ? "" : $"Country: {request.CompanyCountry.Trim()}"
                };
                await _context.Companies.AddAsync(company);
                companyId = company.Id;
            }
        }

        await _context.Recruiters.AddAsync(new Recruiter
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            CompanyId = companyId
        });
    }

    await _context.SaveChangesAsync();

    return true;
}

    #endregion

    #region Login

    public async Task<AuthResponse?> LoginAsync(
        LoginRequest request)
    {
        var email = request.Email.Trim().ToLower();

var user = await _context.Users
    .Include(x => x.RefreshTokens)
    .FirstOrDefaultAsync(x => x.Email == email);

if (user == null)
{
    return null;
}

        if (!user.IsActive)
            return null;
        Guid? companyId = null;

if (user.Role == Role.Recruiter)
{
    companyId = await _context.Recruiters
        .Where(r => r.UserId == user.Id)
        .Select(r => (Guid?)r.CompanyId)
        .FirstOrDefaultAsync();
}

        var validPassword = BCrypt.Net.BCrypt.Verify(
            request.Password,
            user.PasswordHash);

        if (!validPassword)
            return null;

        //--------------------------------------------------
        // ACCESS TOKEN
        //--------------------------------------------------

        var accessToken =
            _jwtService.GenerateAccessToken(
                user.Id,
                user.FullName,
                user.Email,
                user.Role.ToString());

        //--------------------------------------------------
        // REFRESH TOKEN
        //--------------------------------------------------

        var refreshTokenValue =
            _jwtService.GenerateRefreshToken();

        var refreshTokenExpiry =
            _jwtService.GetRefreshTokenExpiry();

        //--------------------------------------------------
        // REMOVE OLD TOKENS
        //--------------------------------------------------

        foreach (var token in user.RefreshTokens
                     .Where(x => x.IsActive))
        {
            token.IsRevoked = true;
        }

        //--------------------------------------------------
        // CREATE NEW TOKEN
        //--------------------------------------------------

        var refreshToken = new RefreshToken
        {
            Id = Guid.NewGuid(),

            Token = refreshTokenValue,

            UserId = user.Id,

            Expires = refreshTokenExpiry,

            IsRevoked = false,

            CreatedAt = DateTime.UtcNow
        };

        await _context.RefreshTokens.AddAsync(
            refreshToken);

        await _context.SaveChangesAsync();

        //--------------------------------------------------
        // RETURN
        //--------------------------------------------------
        return new AuthResponse
        {
            UserId = user.Id,

            FullName = user.FullName,

            Email = user.Email,

            Role = user.Role.ToString(),
            Plan = user.Plan,
            CompanyId = companyId,
            AccessToken = accessToken,

            RefreshToken = refreshToken.Token,

            AccessTokenExpiresAt =
                DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes),

            RefreshTokenExpiresAt =
                refreshToken.Expires
        };
    }

    #endregion

    #region Refresh Token

    public async Task<AuthResponse?> RefreshTokenAsync(
        RefreshTokenRequest request)
    {
        var refreshToken = await _context.RefreshTokens

            .Include(x => x.User)

            .FirstOrDefaultAsync(x =>
                x.Token == request.RefreshToken);

        if (refreshToken == null)
            return null;

        if (!refreshToken.IsActive)
            return null;

        if (!refreshToken.User.IsActive)
            return null;

        //--------------------------------------------------
        // REVOKE OLD TOKEN
        //--------------------------------------------------

        refreshToken.IsRevoked = true;

        //--------------------------------------------------
        // CREATE NEW ACCESS TOKEN
        //--------------------------------------------------

        var accessToken =
            _jwtService.GenerateAccessToken(
                refreshToken.User.Id,
                refreshToken.User.FullName,
                refreshToken.User.Email,
                refreshToken.User.Role.ToString());

        //--------------------------------------------------
        // CREATE NEW REFRESH TOKEN
        //--------------------------------------------------

        var newRefreshToken =
            new RefreshToken
            {
                Id = Guid.NewGuid(),

                UserId = refreshToken.UserId,

                Token = _jwtService.GenerateRefreshToken(),

                Expires = _jwtService.GetRefreshTokenExpiry(),

                IsRevoked = false,

                CreatedAt = DateTime.UtcNow
            };

        await _context.RefreshTokens.AddAsync(
            newRefreshToken);

        await _context.SaveChangesAsync();

        //--------------------------------------------------
        // RETURN
        //--------------------------------------------------

        Guid? companyId = null;
        if (refreshToken.User.Role == Role.Recruiter)
        {
            companyId = await _context.Recruiters
                .Where(r => r.UserId == refreshToken.User.Id)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();
        }

        return new AuthResponse
        {
            UserId = refreshToken.User.Id,

            FullName = refreshToken.User.FullName,

            Email = refreshToken.User.Email,

            Role = refreshToken.User.Role.ToString(),
            Plan = refreshToken.User.Plan,
            CompanyId = companyId,

            AccessToken = accessToken,

            RefreshToken = newRefreshToken.Token,

            AccessTokenExpiresAt =
                DateTime.UtcNow.AddMinutes(_jwtSettings.AccessTokenExpirationMinutes),

            RefreshTokenExpiresAt =
                newRefreshToken.Expires
        };
    }

    #endregion

    #region Logout

    public async Task<bool> LogoutAsync(Guid userId,
        LogoutRequest request)
    {
        var refreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(x =>
            x.Token == request.RefreshToken && x.UserId == userId);

        if (refreshToken == null)
            return false;

        refreshToken.IsRevoked = true;

        await _context.SaveChangesAsync();

        return true;
    }

    #endregion
}
