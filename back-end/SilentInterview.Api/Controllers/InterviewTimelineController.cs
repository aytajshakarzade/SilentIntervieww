using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Interfaces;

namespace SilentInterview.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class InterviewTimelineController(
    IInterviewTimelineService timelineService,
    IInterviewSessionAccessGuard accessGuard) : BaseApiController
{
    [HttpGet("{interviewSessionId:guid}")]
    public async Task<IActionResult> Get(Guid interviewSessionId, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        if (!await accessGuard.CanAccessAsync(this, interviewSessionId, userId, cancellationToken))
            return Failure("Interview session not found.", StatusCodes.Status404NotFound);

        return Success(await timelineService.GetAsync(interviewSessionId, cancellationToken), "Interview timeline retrieved successfully.");
    }
}

