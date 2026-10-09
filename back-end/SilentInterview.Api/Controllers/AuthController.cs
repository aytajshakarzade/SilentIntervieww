using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Net;
using System.Net.Mail;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using Google.Apis.Auth;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Application.Common.Responses;
using SilentInterview.Application.DTOs.Auth;
using SilentInterview.Application.Interfaces;
using SilentInterview.Application.Common.Interfaces;
using Asp.Versioning;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Authentication operations
/// </summary>
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class AuthController : BaseApiController
{
    private readonly IAuthService _authService;
    private readonly SilentInterviewDbContext _context;
    private readonly IJwtService _jwtService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, SilentInterviewDbContext context, IJwtService jwtService, IConfiguration configuration, ILogger<AuthController> logger)
    {
        _authService = authService;
        _context = context;
        _jwtService = jwtService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Register new user
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);

        if (!result)
        {
            return Failure(
                "Unable to create the account. This email may already be registered, or the account details are invalid.",
                StatusCodes.Status400BadRequest);
        }

        return Success(
            true,
            "User registered successfully.");
    }

    /// <summary>
    /// Returns the public Google OAuth client id used by the frontend.
    /// The value is not a secret; the actual Google credential is still validated server-side.
    /// </summary>
    [HttpGet("google/config")]
    [AllowAnonymous]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult GoogleConfig()
    {
        var clientId = ResolveGoogleClientIds().FirstOrDefault() ?? string.Empty;

        return Success(new
        {
            clientId,
            configured = !string.IsNullOrWhiteSpace(clientId)
        }, "Google sign-in configuration retrieved.");
    }

    /// <summary>
    /// Login
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        if (result == null)
        {
            return Failure(
                "Invalid email or password.",
                StatusCodes.Status401Unauthorized);
        }

        SetRefreshTokenCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        // The refresh token is protected by an HttpOnly cookie and is not exposed to browser JavaScript.
        result.RefreshToken = string.Empty;

        return Success(
            result,
            "Login successful.");
    }

    /// <summary>
    /// Refresh Access Token
    /// </summary>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        RefreshTokenRequest request)
    {
        var refreshToken = string.IsNullOrWhiteSpace(request.RefreshToken)
            ? Request.Cookies[RefreshCookieName]
            : request.RefreshToken;

        if (string.IsNullOrWhiteSpace(refreshToken))
            return Failure("Refresh token is missing.", StatusCodes.Status401Unauthorized);

        request.RefreshToken = refreshToken;
        var result = await _authService.RefreshTokenAsync(request);

        if (result == null)
        {
            return Failure(
                "Refresh token is invalid or expired.",
                StatusCodes.Status401Unauthorized);
        }

        SetRefreshTokenCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        result.RefreshToken = string.Empty;

        return Success(
            result,
            "Token refreshed successfully.");
    }

    /// <summary>
    /// Logout
    /// </summary>
    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Logout(
        LogoutRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userId, out var parsedUserId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            request.RefreshToken = Request.Cookies[RefreshCookieName] ?? string.Empty;

        var result = await _authService.LogoutAsync(parsedUserId, request);
        Response.Cookies.Delete(RefreshCookieName, RefreshCookieOptions());

        if (!result)
        {
            return Failure(
                "Logout failed.",
                StatusCodes.Status400BadRequest);
        }

        return Success(
            true,
            "Logout successful.");
    }

    [HttpPost("google")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    public async Task<IActionResult> Google(GoogleLoginRequest request)
    {
        GoogleJsonWebSignature.Payload payload;
        try
        {
            if (!string.IsNullOrWhiteSpace(request.SetupToken))
            {
                payload = ValidateGoogleSetupToken(request.SetupToken);
            }
            else
            {
                if (string.IsNullOrWhiteSpace(request.Credential))
                    return Failure("Google credential is required.", StatusCodes.Status400BadRequest);

                var clientIds = ResolveGoogleClientIds();
                if (clientIds.Length == 0)
                    return Failure("Google sign-in is not configured.", StatusCodes.Status503ServiceUnavailable);

                // Verify the Google ID token cryptographically. Audience is checked
                // explicitly below so we can support the same web client id coming
                // from either frontend build configuration or backend environment.
                payload = await GoogleJsonWebSignature.ValidateAsync(request.Credential);

                var audience = payload.Audience?.ToString()?.Trim() ?? string.Empty;
                if (string.IsNullOrWhiteSpace(audience) ||
                    !clientIds.Contains(audience, StringComparer.Ordinal))
                {
                    _logger.LogWarning("Google ID token audience mismatch.");
                    return Failure("This Google sign-in belongs to a different application. Check the Google client configuration.", StatusCodes.Status401Unauthorized);
                }

                var issuer = payload.Issuer?.Trim();
                if (!string.Equals(issuer, "accounts.google.com", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(issuer, "https://accounts.google.com", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning("Google ID token issuer mismatch.");
                    return Failure("Google sign-in could not be verified. Please try again.", StatusCodes.Status401Unauthorized);
                }

                // The first verification is enough. Issue a signed, 10-minute setup
                // ticket so the role/company completion step does not need to re-call
                // Google's verification endpoint with the same ID token.
                var existingUser = await _context.Users.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(x => x.Email == payload.Email.Trim().ToLowerInvariant());

                if (existingUser != null)
                {
                    if (!existingUser.IsActive || existingUser.IsDeleted)
                        return Failure("This account is suspended. Contact your administrator.", StatusCodes.Status403Forbidden);

                    existingUser.EmailConfirmed = true;
                    var auth = BuildAuthResponse(existingUser);
                    if (existingUser.Role == Role.Recruiter)
                    {
                        auth.CompanyId = await _context.Recruiters
                            .Where(r => r.UserId == existingUser.Id)
                            .Select(r => (Guid?)r.CompanyId)
                            .FirstOrDefaultAsync();
                    }
                    await _context.SaveChangesAsync();
                    SetRefreshTokenCookie(auth.RefreshToken, auth.RefreshTokenExpiresAt);
                    auth.RefreshToken = string.Empty;
                    return Success(auth, "Google sign-in successful.");
                }

                return Success(new
                {
                    requiresSetup = true,
                    email = payload.Email.Trim().ToLowerInvariant(),
                    name = payload.Name ?? payload.Email.Split('@')[0],
                    setupToken = CreateGoogleSetupToken(payload)
                }, "Google account verified. Choose your role to continue.");
            }
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning(ex, "Google ID token validation failed.");
            return Failure("Google sign-in could not be verified. Please try again.", StatusCodes.Status401Unauthorized);
        }
        catch (SecurityTokenException ex)
        {
            _logger.LogWarning(ex, "Google setup token validation failed.");
            return Failure("Your Google setup session has expired. Please start again.", StatusCodes.Status401Unauthorized);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google sign-in validation failed unexpectedly.");
            return Failure("Google sign-in is temporarily unavailable. Please retry.", StatusCodes.Status503ServiceUnavailable);
        }

        try
        {
            var email = payload.Email.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email))
                return Failure("Google account email is missing.", StatusCodes.Status400BadRequest);

            var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Email == email);
            if (user != null)
            {
                if (!user.IsActive || user.IsDeleted)
                    return Failure("This account is suspended. Contact your administrator.", StatusCodes.Status403Forbidden);

                // The setup page may be retried after the first request has already
                // committed the account. Treat that case as an idempotent completion
                // of the same Google onboarding session instead of surfacing a
                // misleading duplicate-email/workspace error.
                if (!string.IsNullOrWhiteSpace(request.SetupToken))
                {
                    user.EmailConfirmed = true;
                    var auth = BuildAuthResponse(user);
                    if (user.Role == Role.Recruiter)
                    {
                        auth.CompanyId = await _context.Recruiters
                            .Where(r => r.UserId == user.Id)
                            .Select(r => (Guid?)r.CompanyId)
                            .FirstOrDefaultAsync();
                    }
                    await _context.SaveChangesAsync();
                    SetRefreshTokenCookie(auth.RefreshToken, auth.RefreshTokenExpiresAt);
                    auth.RefreshToken = string.Empty;
                    return Success(auth, "Google sign-in successful.");
                }

                return Failure("This Google account is already registered. Please sign in with Google again.", StatusCodes.Status409Conflict);
            }

            if (string.IsNullOrWhiteSpace(request.Role))
                return Failure("Choose Candidate or Recruiter.", StatusCodes.Status400BadRequest);

            if (!Enum.TryParse<Role>(request.Role, true, out var requestedRole) ||
                requestedRole is not (Role.Candidate or Role.Recruiter))
                return Failure("Choose Candidate or Recruiter.", StatusCodes.Status400BadRequest);

            Guid? companyId = null;
            var countryCode = NormalizeCountryCode(request.CompanyCountry);
            if (requestedRole == Role.Recruiter)
            {
                if (!request.CompanyId.HasValue && string.IsNullOrWhiteSpace(request.CompanyName))
                    return Failure("Choose a company or enter your company name.", StatusCodes.Status400BadRequest);

                if (string.IsNullOrWhiteSpace(countryCode))
                    return Failure("Choose a valid country before continuing.", StatusCodes.Status400BadRequest);

                if (request.CompanyId.HasValue)
                {
                    var selectedCompany = await _context.Companies
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(c => c.Id == request.CompanyId.Value);
                    if (selectedCompany == null)
                        return Failure("Selected company could not be found.", StatusCodes.Status400BadRequest);
                    if (selectedCompany.IsDeleted)
                    {
                        selectedCompany.IsDeleted = false;
                        selectedCompany.DeletedAt = null;
                        selectedCompany.UpdatedAt = DateTime.UtcNow;
                    }
                    companyId = selectedCompany.Id;
                }
                else if (!string.IsNullOrWhiteSpace(request.CompanyName))
                {
                    var normalizedDirectoryName = Regex.Replace(request.CompanyName.Trim(), @"\s+", " ");
                    var normalizedDirectoryNameLower = normalizedDirectoryName.ToLowerInvariant();
                    var existingDirectoryCompany = await _context.Companies
                        .IgnoreQueryFilters()
                        .FirstOrDefaultAsync(c =>
                            c.Name.ToLower() == normalizedDirectoryNameLower &&
                            c.CountryCode == countryCode);

                    if (existingDirectoryCompany != null)
                    {
                        existingDirectoryCompany.IsDeleted = false;
                        existingDirectoryCompany.DeletedAt = null;
                        existingDirectoryCompany.UpdatedAt = DateTime.UtcNow;
                        companyId = existingDirectoryCompany.Id;
                    }
                }
            }

            user = new User
            {
                Id = Guid.NewGuid(),
                FullName = payload.Name ?? email.Split('@')[0],
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                Role = requestedRole,
                EmailConfirmed = true,
                IsActive = true,
                Plan = "Free"
            };

            await _context.Users.AddAsync(user);

            if (requestedRole == Role.Candidate)
            {
                await _context.Candidates.AddAsync(new Candidate
                {
                    Id = Guid.NewGuid(), UserId = user.Id,
                    ResumeUrl = "", Skills = "", Education = "", Experience = ""
                });
            }
            else
            {
                if (!companyId.HasValue && !string.IsNullOrWhiteSpace(request.CompanyName))
                {
                    var normalizedName = Regex.Replace(request.CompanyName.Trim(), @"\s+", " ");
                    var normalizedNameLower = normalizedName.ToLowerInvariant();
                    var existing = await _context.Companies.IgnoreQueryFilters()
                        .FirstOrDefaultAsync(c =>
                            c.Name.ToLower() == normalizedNameLower &&
                            c.CountryCode == countryCode);
                    if (existing != null)
                    {
                        // Reuse an existing workspace even when it was soft-deleted.
                        // This prevents unique-name conflicts in databases that retain
                        // historical workspaces while keeping the Google onboarding idempotent.
                        existing.IsDeleted = false;
                        existing.DeletedAt = null;
                        existing.UpdatedAt = DateTime.UtcNow;
                        if (string.IsNullOrWhiteSpace(existing.Industry) && !string.IsNullOrWhiteSpace(request.CompanyIndustry))
                            existing.Industry = request.CompanyIndustry.Trim();
                        if (string.IsNullOrWhiteSpace(existing.CountryCode))
                            existing.CountryCode = countryCode;
                        companyId = existing.Id;
                    }
                    else
                    {
                        var company = new Company
                        {
                            Id = Guid.NewGuid(),
                            Name = normalizedName,
                            Industry = string.IsNullOrWhiteSpace(request.CompanyIndustry) ? "General" : request.CompanyIndustry.Trim(),
                            CountryCode = countryCode,
                            Description = string.IsNullOrWhiteSpace(request.CompanyCountry) ? "" : $"Country: {request.CompanyCountry.Trim()}"
                        };
                        await _context.Companies.AddAsync(company);
                        companyId = company.Id;
                    }
                }

                if (!companyId.HasValue)
                    return Failure("A recruiter account requires a company.", StatusCodes.Status400BadRequest);

                await _context.Recruiters.AddAsync(new Recruiter
                {
                    Id = Guid.NewGuid(), UserId = user.Id, CompanyId = companyId.Value
                });
            }

            await _context.SaveChangesAsync();
            var authResponse = BuildAuthResponse(user);
            authResponse.CompanyId = companyId;
            await _context.SaveChangesAsync();
            SetRefreshTokenCookie(authResponse.RefreshToken, authResponse.RefreshTokenExpiresAt);
            authResponse.RefreshToken = string.Empty;
            return Success(authResponse, "Google account created successfully.");
        }
        catch (DbUpdateException ex)
        {
            // Google setup is intentionally idempotent. A double-click, retry, or
            // two concurrent browser requests can race after the initial token
            // verification and one request may create the user before the other.
            // In that case the unique email constraint is expected: reload the
            // committed user and finish sign-in instead of showing a false
            // "workspace already exists" error.
            _logger.LogWarning(ex, "Google account creation hit a database uniqueness conflict; attempting idempotent sign-in.");

            var normalizedEmail = payload.Email?.Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(normalizedEmail))
            {
                var existingUser = await _context.Users.IgnoreQueryFilters()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Email == normalizedEmail);

                if (existingUser != null)
                {
                    if (!existingUser.IsActive || existingUser.IsDeleted)
                        return Failure("This account is suspended. Contact your administrator.", StatusCodes.Status403Forbidden);

                    var auth = BuildAuthResponse(existingUser);
                    if (existingUser.Role == Role.Recruiter)
                    {
                        auth.CompanyId = await _context.Recruiters
                            .Where(r => r.UserId == existingUser.Id)
                            .Select(r => (Guid?)r.CompanyId)
                            .FirstOrDefaultAsync();
                    }
                    await _context.SaveChangesAsync();
                    SetRefreshTokenCookie(auth.RefreshToken, auth.RefreshTokenExpiresAt);
                    auth.RefreshToken = string.Empty;
                    return Success(auth, "Google sign-in successful.");
                }
            }

            return Failure("We couldn't finish creating the recruiter workspace. Please review the company selection and try again.", StatusCodes.Status409Conflict);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Google account creation failed unexpectedly.");
            return Failure("We couldn't finish setting up your Google account. Please retry.", StatusCodes.Status500InternalServerError);
        }
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Email == email);
        // Do not reveal whether an account exists.
        if (user == null) return Success(true, "If an account exists, a reset email has been sent.");

        var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))
            .Replace("+","-").Replace("/","_").Replace("=","");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
        await _context.PasswordResetTokens.AddAsync(new PasswordResetToken {
            Id=Guid.NewGuid(), UserId=user.Id, TokenHash=hash, ExpiresAt=DateTime.UtcNow.AddMinutes(30)
        });
        await _context.SaveChangesAsync();

        var frontend = _configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
        var resetUrl = $"{frontend.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}&email={Uri.EscapeDataString(email)}";
        await SendEmailAsync(email, "Reset your SilentInterview password",
            $"<p>We received a password reset request.</p><p><a href=\"{resetUrl}\">Reset password</a></p><p>This link expires in 30 minutes.</p>");
        return Success(true, "If an account exists, a reset email has been sent.");
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    [EnableRateLimiting("authentication")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token)));
        var item = await _context.PasswordResetTokens.Include(x=>x.User)
            .FirstOrDefaultAsync(x => x.TokenHash == hash && x.UsedAt == null && x.ExpiresAt > DateTime.UtcNow && x.User.Email == request.Email.Trim().ToLower());
        if (item == null) return Failure("Invalid or expired reset link.", StatusCodes.Status400BadRequest);
        item.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        item.UsedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return Success(true, "Password reset successfully.");
    }

    private string CreateGoogleSetupToken(GoogleJsonWebSignature.Payload payload)
    {
        var jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
            throw new SecurityTokenException("JWT key is not configured.");

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, payload.Email.Trim().ToLowerInvariant()),
            new(JwtRegisteredClaimNames.Email, payload.Email.Trim().ToLowerInvariant()),
            new(JwtRegisteredClaimNames.UniqueName, payload.Name ?? payload.Email.Split('@')[0]),
            new("purpose", "google_setup")
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(10),
            Issuer = _configuration["Jwt:Issuer"] ?? "SilentInterview",
            Audience = _configuration["Jwt:Audience"] ?? "SilentInterviewUsers",
            SigningCredentials = creds
        };

        var handler = new JwtSecurityTokenHandler();
        return handler.WriteToken(handler.CreateToken(descriptor));
    }

    private GoogleJsonWebSignature.Payload ValidateGoogleSetupToken(string token)
    {
        var jwtKey = _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
            throw new SecurityTokenException("JWT key is not configured.");

        var tokenHandler = new JwtSecurityTokenHandler();
        var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = _configuration["Jwt:Issuer"] ?? "SilentInterview",
            ValidateAudience = true,
            ValidAudience = _configuration["Jwt:Audience"] ?? "SilentInterviewUsers",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        }, out _);

        var purpose = principal.FindFirstValue("purpose");
        if (!string.Equals(purpose, "google_setup", StringComparison.Ordinal))
            throw new SecurityTokenException("Invalid Google setup token purpose.");

        var email = principal.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? principal.FindFirstValue(ClaimTypes.Email)
            ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (string.IsNullOrWhiteSpace(email))
            throw new SecurityTokenException("Google setup token is missing an email.");

        return new GoogleJsonWebSignature.Payload
        {
            Email = email,
            Name = principal.FindFirstValue(JwtRegisteredClaimNames.UniqueName)
                ?? principal.FindFirstValue(ClaimTypes.Name)
                ?? email.Split('@')[0],
            Audience = _configuration["Google:ClientId"] ?? string.Empty,
            Issuer = "accounts.google.com"
        };
    }

    private string[] ResolveGoogleClientIds()
    {
        var candidates = new[]
        {
            _configuration["Google:ClientId"],
            _configuration["Google__ClientId"],
            _configuration["VITE_GOOGLE_CLIENT_ID"],
            Environment.GetEnvironmentVariable("Google__ClientId"),
            Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID"),
            Environment.GetEnvironmentVariable("VITE_GOOGLE_CLIENT_ID")
        };

        return candidates
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Select(x => x!.Trim())
            .Where(x => !x.Equals("YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", StringComparison.OrdinalIgnoreCase))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private AuthResponse BuildAuthResponse(User user)
    {
        var access = _jwtService.GenerateAccessToken(user.Id, user.FullName, user.Email, user.Role.ToString());
        var refresh = _jwtService.GenerateRefreshToken();
        var entity = new RefreshToken { Id=Guid.NewGuid(), UserId=user.Id, Token=refresh, Expires=_jwtService.GetRefreshTokenExpiry(), CreatedAt=DateTime.UtcNow };
        _context.RefreshTokens.Add(entity);
        return new AuthResponse {
            UserId=user.Id, FullName=user.FullName, Email=user.Email, Role=user.Role.ToString(),
            Plan=user.Plan, AccessToken=access, RefreshToken=refresh,
            AccessTokenExpiresAt=DateTime.UtcNow.AddMinutes(15), RefreshTokenExpiresAt=entity.Expires
        };
    }

    private async Task SendEmailAsync(string to, string subject, string html)
    {
        var host = _configuration["Smtp:Host"];
        var port = int.TryParse(_configuration["Smtp:Port"], out var p) ? p : 587;
        var from = _configuration["Smtp:From"];
        var user = _configuration["Smtp:Username"];
        var pass = _configuration["Smtp:Password"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            throw new InvalidOperationException("SMTP is not configured. Set Smtp:Host, Smtp:From, Smtp:Username and Smtp:Password.");
        using var client = new SmtpClient(host, port) { EnableSsl = true, Credentials = new NetworkCredential(user, pass) };
        using var mail = new MailMessage(from, to, subject, html) { IsBodyHtml = true };
        await client.SendMailAsync(mail);
    }

    private const string RefreshCookieName = "silentinterview.refresh";

    private void SetRefreshTokenCookie(string token, DateTime expiresAt)
    {
        Response.Cookies.Append(RefreshCookieName, token, RefreshCookieOptions(expiresAt));
    }

    private CookieOptions RefreshCookieOptions(DateTime? expiresAt = null)
    {
        var sameSiteValue = _configuration["Auth:RefreshCookieSameSite"] ?? "Lax";
        var sameSite = Enum.TryParse<SameSiteMode>(sameSiteValue, true, out var parsed) ? parsed : SameSiteMode.Lax;
        var secure = !HttpContext.Request.IsHttps && sameSite == SameSiteMode.None ? true : !string.Equals(_configuration["Auth:RefreshCookieSecure"], "false", StringComparison.OrdinalIgnoreCase);
        if (_configuration["Auth:RefreshCookieSecure"] == null)
            secure = HttpContext.Request.IsHttps;

        return new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            Path = "/api/v1/Auth",
            Expires = expiresAt.HasValue ? new DateTimeOffset(expiresAt.Value) : null,
            IsEssential = true
        };
    }

    private static string NormalizeCountryCode(string? value)
    {
        var code = value?.Trim().ToUpperInvariant() ?? string.Empty;
        return code.Length == 2 && code.All(char.IsLetter) ? code : string.Empty;
    }

    public sealed record GoogleLoginRequest(string Credential, string? Role = null, Guid? CompanyId = null, string? CompanyName = null, string? CompanyCountry = null, string? CompanyIndustry = null, string? SetupToken = null);
    public sealed record ForgotPasswordRequest(string Email);
    public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);

}
