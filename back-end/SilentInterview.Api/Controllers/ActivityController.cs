using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

[Authorize(Roles = "Recruiter,SuperAdmin")]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class ActivityController(IActivityLogService activityLogService, SilentInterviewDbContext context) : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetRecent([FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        Guid? companyId = null;
        if (!User.IsInRole("SuperAdmin"))
        {
            companyId = await context.Recruiters
                .Where(recruiter => recruiter.UserId == userId)
                .Select(recruiter => (Guid?)recruiter.CompanyId)
                .SingleOrDefaultAsync(cancellationToken);
            if (!companyId.HasValue)
                return Failure("Recruiter company membership could not be found.", StatusCodes.Status403Forbidden);
        }

        var activities = await activityLogService.GetRecentForCompanyAsync(companyId, take, cancellationToken);
        return Success(activities, "Recent activity retrieved successfully.");
    }
}
