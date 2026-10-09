using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.JobApplication;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Job Application Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class JobApplicationController : BaseApiController
{
    private readonly IJobApplicationService _jobApplicationService;
    private readonly IActivityLogService _activityLogService;
    private readonly INotificationService _notificationService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;

    public JobApplicationController(
        IJobApplicationService jobApplicationService,
        IActivityLogService activityLogService,
        INotificationService notificationService,
        SilentInterviewDbContext context,
        IUserScopeResolver scopeResolver)
    {
        _jobApplicationService = jobApplicationService;
        _activityLogService = activityLogService;
        _notificationService = notificationService;
        _scopeResolver = scopeResolver;
        _context = context;
    }

    /// <summary>
    /// Get all applications.
    /// Supports pagination, filtering, searching and sorting.
    /// Recruiters only see applications for their own company's jobs.
    /// Candidates only see their own applications.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] JobApplicationQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var applications = await _jobApplicationService.GetAllAsync(parameters, scope.CompanyId, scope.CandidateUserId);

        return Success(
            applications,
            "Applications retrieved successfully.");
    }

    /// <summary>
    /// Get application by id.
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var application = await _jobApplicationService.GetByIdAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (application == null)
        {
            return Failure(
                "Application not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            application,
            "Application retrieved successfully.");
    }

    /// <summary>
    /// Create application.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateJobApplicationRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        if (User.IsInRole("Candidate"))
        {
            var candidateId = await _context.Candidates
                .Where(candidate => candidate.UserId == userId)
                .Select(candidate => (Guid?)candidate.Id)
                .SingleOrDefaultAsync();
            if (!candidateId.HasValue)
                return Failure("Candidate profile must be completed before applying.", StatusCodes.Status400BadRequest);
            request.CandidateId = candidateId.Value;
        }

        var application = await _jobApplicationService.CreateAsync(request);
        await _activityLogService.RecordApplicationEventAsync(
            application.Id, userId, "ApplicationCreated", $"Application submitted for {application.JobTitle}.");

        return Success(
            application,
            "Application created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update application status.
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateJobApplicationRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var applicationScope = await _context.JobApplications
            .Where(application => application.Id == id)
            .Join(_context.Jobs,
                application => application.JobId,
                job => job.Id,
                (application, job) => new
                {
                    CandidateUserId = application.Candidate.UserId,
                    job.CompanyId,
                    job.Title
                })
            .FirstOrDefaultAsync();

        if (applicationScope is null)
            return Failure("Application not found.", StatusCodes.Status404NotFound);

        if (!User.IsInRole("SuperAdmin"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (recruiterCompanyId is null || recruiterCompanyId.Value != applicationScope.CompanyId)
                return Failure("You do not have access to this application.", StatusCodes.Status403Forbidden);
        }

        var (success, errorMessage) = await _jobApplicationService.UpdateAsync(id, request);

        if (!success)
        {
            if (errorMessage != null && errorMessage.Contains("Cannot transition"))
            {
                return Failure(errorMessage, StatusCodes.Status409Conflict);
            }
            return Failure(errorMessage ?? "Application not found.", StatusCodes.Status404NotFound);
        }

        await _activityLogService.RecordApplicationEventAsync(
            id, userId, "ApplicationStatusChanged", $"{applicationScope.Title} moved to {request.Status}.");
        await _notificationService.CreateAsync(
            applicationScope.CandidateUserId,
            "ApplicationStatusChanged",
            "Application status updated",
            $"Your application for {applicationScope.Title} is now {request.Status}.",
            "/candidate/dashboard");

        return Success(
            true,
            "Application updated successfully.");
    }

    /// <summary>
    /// Delete application.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var deleted = await _jobApplicationService.DeleteAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (!deleted)
        {
            return Failure(
                "Application not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Application deleted successfully.");
    }

    /// <summary>
    /// Restore a soft-deleted application.
    /// </summary>
    [HttpPut("{id:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError)
            return scope.Error!;

        var restored = await _jobApplicationService.RestoreAsync(id, scope.CompanyId, scope.CandidateUserId);

        if (!restored)
        {
            return Failure(
                "Application not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Application restored successfully.");
    }

}
