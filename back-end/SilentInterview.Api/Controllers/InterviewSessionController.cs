using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.InterviewSession;
using SilentInterview.Application.Interfaces;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Interview Session Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class InterviewSessionController : BaseApiController
{
    private readonly IInterviewSessionService _service;
    private readonly IInterviewTimelineService _timelineService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;

    public InterviewSessionController(
        IInterviewSessionService service,
        IInterviewTimelineService timelineService,
        SilentInterviewDbContext context,
        IUserScopeResolver scopeResolver)
    {
        _service = service;
        _timelineService = timelineService;
        _context = context;
        _scopeResolver = scopeResolver;
    }

    /// <summary>
    /// Get all interview sessions.
    /// Supports pagination, filtering, searching and sorting.
    /// Recruiters only see sessions tied to their own company's job applications.
    /// Candidates only see their own interview sessions.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] InterviewSessionQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var sessions = await _service.GetAllAsync(parameters, scope.CompanyId, scope.CandidateUserId);

        return Success(
            sessions,
            "Interview sessions retrieved successfully.");
    }

    /// <summary>
    /// Get interview session by id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var session = await _service.GetByIdAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (session == null)
        {
            return Failure(
                "Interview session not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            session,
            "Interview session retrieved successfully.");
    }

    /// <summary>
    /// Create interview session.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateInterviewSessionRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        if (!await CanAccessApplicationAsync(request.JobApplicationId, userId))
            return Failure("Job application not found.", StatusCodes.Status404NotFound);

        var user = await _context.Users.FindAsync(userId);
        var plan = SilentInterview.Api.Subscriptions.PlanLimits.EffectivePlan(user?.Plan, user?.SubscriptionCurrentPeriodEnd);
        var monthlyLimit = SilentInterview.Api.Subscriptions.PlanLimits.InterviewsPerMonth(plan);
        if (monthlyLimit > 0)
        {
            var monthStart = SilentInterview.Api.Subscriptions.PlanLimits.MonthStartUtc();
            var used = await _context.InterviewSessions
                .CountAsync(x => x.StartedAt >= monthStart &&
                    (User.IsInRole("Candidate")
                        ? x.JobApplication.Candidate.UserId == userId
                        : x.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)));
            if (used >= monthlyLimit)
                return Failure($"Monthly interview limit reached for your {plan} plan. Upgrade to continue.", StatusCodes.Status402PaymentRequired);
        }

        // Creating a new interview automatically generates its AI interview plan
        // in InterviewSessionService. Count that generation against the same AI
        // allowance shown in Billing, so the advertised 10/100/unlimited quota
        // is a real platform entitlement rather than a UI-only number.
        var aiLimit = SilentInterview.Api.Subscriptions.PlanLimits.AiActionsPerMonth(plan);
        if (aiLimit >= 0)
        {
            var monthStart = SilentInterview.Api.Subscriptions.PlanLimits.MonthStartUtc();
            var usedAi = await _context.AIInterviewPlans.CountAsync(x => x.CreatedAt >= monthStart &&
                (User.IsInRole("Candidate")
                    ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                    : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)))
                + await _context.Reports.CountAsync(x => x.CreatedAt >= monthStart &&
                (User.IsInRole("Candidate")
                    ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                    : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)));
            if (usedAi >= aiLimit)
                return Failure($"You have reached the {plan} plan's monthly AI action limit. Upgrade to continue.", StatusCodes.Status402PaymentRequired);
        }

        var session = await _service.CreateAsync(request);
        Guid? actorId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId) ? parsedUserId : null;
        await _timelineService.RecordAsync(session.Id, actorId, "InterviewStarted", "Interview session started.");

        return Success(
            session,
            "Interview session created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update interview session.
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateInterviewSessionRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        var applicationId = await _context.InterviewSessions
            .Where(session => session.Id == id)
            .Select(session => (Guid?)session.JobApplicationId)
            .SingleOrDefaultAsync();
        if (!applicationId.HasValue || !await CanAccessApplicationAsync(applicationId.Value, userId))
            return Failure("Interview session not found.", StatusCodes.Status404NotFound);

        var updated = await _service.UpdateAsync(id, request);

        if (!updated)
        {
            return Failure(
                "Interview session not found.",
                StatusCodes.Status404NotFound);
        }

        if (request.EndedAt.HasValue)
        {
            Guid? actorId = Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsedUserId) ? parsedUserId : null;
            await _timelineService.RecordAsync(id, actorId, "InterviewCompleted", "Interview session completed.");
        }

        return Success(
            true,
            "Interview session updated successfully.");
    }

    /// <summary>
    /// Delete interview session.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var applicationId = await _context.InterviewSessions
            .Where(session => session.Id == id)
            .Select(session => (Guid?)session.JobApplicationId)
            .SingleOrDefaultAsync();
        if (!applicationId.HasValue || !await CanAccessApplicationAsync(applicationId.Value, userId))
            return Failure("Interview session not found.", StatusCodes.Status404NotFound);

        Guid? scopeCompanyId = null;
        if (!User.IsInRole("SuperAdmin") && !User.IsInRole("Candidate"))
        {
            scopeCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();
        }

        var deleted = await _service.DeleteAsync(id, scopeCompanyId);

        if (!deleted)
        {
            return Failure(
                "Interview session not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Interview session deleted successfully.");
    }

    private async Task<bool> CanAccessApplicationAsync(Guid applicationId, Guid userId)
    {
        if (User.IsInRole("SuperAdmin"))
            return await _context.JobApplications.AnyAsync(application => application.Id == applicationId);
        if (User.IsInRole("Candidate"))
            return await _context.JobApplications.AnyAsync(application =>
                application.Id == applicationId && application.Candidate.UserId == userId);

        return await _context.JobApplications.AnyAsync(application => application.Id == applicationId &&
            _context.Recruiters.Any(recruiter => recruiter.UserId == userId && recruiter.CompanyId == application.Job.CompanyId));
    }

}
