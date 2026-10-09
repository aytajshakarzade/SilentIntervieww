using System.Security.Claims;
using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Application.DTOs.Analytics;
using SilentInterview.Application.Interfaces;
using SilentInterview.Api.Subscriptions;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

[Authorize(Roles = "Recruiter,SuperAdmin")]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class AnalyticsController(IAnalyticsService analyticsService, SilentInterviewDbContext context) : BaseApiController
{
    [HttpGet("core-overview")]
    [ProducesResponseType(typeof(AnalyticsOverviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCoreOverview([FromQuery] string? period, CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var overview = await analyticsService.GetOverviewAsync(userId, role, period, cancellationToken);
        return Success(overview, "Core analytics retrieved successfully.");
    }

    [HttpGet("overview")]
    [ProducesResponseType(typeof(AnalyticsOverviewDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOverview([FromQuery] string? period, CancellationToken cancellationToken)
    {
        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        if (string.Equals(role, "Recruiter", StringComparison.OrdinalIgnoreCase))
        {
            var user = await context.Users.FindAsync(new object[] { userId }, cancellationToken);
            var plan = PlanLimits.EffectivePlan(user?.Plan, user?.SubscriptionCurrentPeriodEnd);
            if (!PlanLimits.HasAdvancedAnalytics(plan))
                return Failure("Advanced analytics are available on Go and Pro plans. Upgrade to continue.", StatusCodes.Status402PaymentRequired);
        }

        var overview = await analyticsService.GetOverviewAsync(userId, role, period, cancellationToken);
        return Success(overview, "Analytics retrieved successfully.");
    }
}
