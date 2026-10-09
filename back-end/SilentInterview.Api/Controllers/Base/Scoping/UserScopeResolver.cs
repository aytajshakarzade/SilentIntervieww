using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Application.Common.Responses;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers.Base.Scoping;

/// <inheritdoc cref="IUserScopeResolver"/>
public sealed class UserScopeResolver : IUserScopeResolver
{
    private readonly SilentInterviewDbContext _context;

    public UserScopeResolver(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<ScopeInfo> GetScopeAsync(ControllerBase controller)
    {
        var user = controller.User;

        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return ScopeInfo.Failed(Fail("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized));
        }

        if (user.IsInRole("SuperAdmin"))
            return ScopeInfo.Ok();

        if (user.IsInRole("Candidate"))
        {
            return ScopeInfo.Ok(candidateUserId: userId);
        }

        var recruiterCompanyId = await ResolveRecruiterCompanyIdAsync(userId);

        if (!recruiterCompanyId.HasValue)
        {
            return ScopeInfo.Failed(Fail("Recruiter profile not found.", StatusCodes.Status403Forbidden));
        }

        return ScopeInfo.Ok(companyId: recruiterCompanyId.Value);
    }

    public async Task<ScopeInfo> GetCompanyScopeAsync(ControllerBase controller)
    {
        var user = controller.User;

        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return ScopeInfo.Failed(Fail("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized));
        }

        if (user.IsInRole("SuperAdmin"))
            return ScopeInfo.Ok();

        if (user.IsInRole("Recruiter"))
        {
            var recruiterCompanyId = await ResolveRecruiterCompanyIdAsync(userId);

            if (!recruiterCompanyId.HasValue)
            {
                return ScopeInfo.Failed(Fail("Recruiter profile not found.", StatusCodes.Status403Forbidden));
            }

            return ScopeInfo.Ok(companyId: recruiterCompanyId.Value);
        }

        // Candidates (and any other authenticated role) get unrestricted read scope here;
        // write endpoints are locked down separately via [Authorize(Roles = ...)].
        return ScopeInfo.Ok();
    }

    private async Task<Guid?> ResolveRecruiterCompanyIdAsync(Guid userId)
    {
        return await _context.Recruiters
            .Where(r => r.UserId == userId)
            .Select(r => (Guid?)r.CompanyId)
            .FirstOrDefaultAsync();
    }

    private static IActionResult Fail(string message, int statusCode)
    {
        // Reuses the same ApiResponseFactory envelope BaseApiController.Failure() produces,
        // so error responses are identical whether resolved here or in the old per-controller code.
        return new ObjectResult(ApiResponseFactory.Fail<object>(message, statusCode))
        {
            StatusCode = statusCode
        };
    }
}
