using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Subscriptions;
using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Job;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Job Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class JobController : BaseApiController
{
    private readonly IJobService _jobService;
    private readonly SilentInterviewDbContext _context;

    public JobController(IJobService jobService, SilentInterviewDbContext context)
    {
        _jobService = jobService;
        _context = context;
    }

    /// <summary>
    /// Get all jobs
    /// Supports pagination, search, filtering and sorting.
    /// Recruiters are always scoped to their own company. Candidates only see public, non-deleted jobs.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] JobQueryParameters parameters)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? scopeCompanyId = null;

        if (User.IsInRole("Recruiter"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            scopeCompanyId = recruiterCompanyId.Value;
        }
        else if (User.IsInRole("Candidate"))
        {
            // Candidates browsing available interviews must never see deleted/archived jobs
            // and must never receive duplicated or cross-company data because of missing filtering.
            parameters.IncludeDeleted = false;
            parameters.OnlyDeleted = false;
            // Candidates cannot request an arbitrary CompanyId filter to scope-browse another company deliberately restricted;
            // but browsing across companies for open jobs is intended public behavior, so no companyId scope is forced here.
        }
        // SuperAdmins: no scope restriction.

        var jobs = await _jobService.GetAllAsync(parameters, scopeCompanyId);

        return Success(
            jobs,
            "Jobs retrieved successfully.");
    }

    /// <summary>
    /// Get job by id
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? scopeCompanyId = null;

        if (User.IsInRole("Recruiter"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            scopeCompanyId = recruiterCompanyId.Value;
        }

        var job = await _jobService.GetByIdAsync(id, scopeCompanyId);

        if (job == null)
        {
            return Failure(
                "Job not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            job,
            "Job retrieved successfully.");
    }

    /// <summary>
    /// Create job
    /// </summary>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateJobRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        if (!User.IsInRole("SuperAdmin"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            var recruiter = await _context.Users.FindAsync(userId);
            var jobPlan = PlanLimits.EffectivePlan(recruiter?.Plan, recruiter?.SubscriptionCurrentPeriodEnd);
            var jobLimit = PlanLimits.ActiveJobs(jobPlan);
            if (jobLimit > 0)
            {
                var activeJobs = await _context.Jobs.CountAsync(j => j.CompanyId == recruiterCompanyId.Value && !j.IsDeleted);
                if (activeJobs >= jobLimit)
                    return Failure($"Your {PlanLimits.EffectivePlan(recruiter?.Plan, recruiter?.SubscriptionCurrentPeriodEnd)} plan allows up to {jobLimit} active jobs. Upgrade to continue.", StatusCodes.Status402PaymentRequired);
            }

            request.CompanyId = recruiterCompanyId.Value;
        }

        var job = await _jobService.CreateAsync(request);

        return Success(
            job,
            "Job created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update job
    /// </summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateJobRequest request)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? scopeCompanyId = null;

        if (!User.IsInRole("SuperAdmin"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            // Global query filter already excludes soft-deleted rows.
            var jobCompanyId = await _context.Jobs
                .Where(j => j.Id == id)
                .Select(j => (Guid?)j.CompanyId)
                .FirstOrDefaultAsync();

            if (!jobCompanyId.HasValue)
                return Failure("Job not found.", StatusCodes.Status404NotFound);

            if (jobCompanyId.Value != recruiterCompanyId.Value)
                return Failure("You do not have access to this job.", StatusCodes.Status403Forbidden);

            request.CompanyId = recruiterCompanyId.Value;
            scopeCompanyId = recruiterCompanyId.Value;
        }

        var updated = await _jobService.UpdateAsync(id, request, scopeCompanyId);

        if (updated == null)
        {
            return Failure(
                "Job not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
           updated,
           "Job updated successfully.");
    }

    /// <summary>
    /// Delete job
    /// </summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? scopeCompanyId = null;

        if (!User.IsInRole("SuperAdmin"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            scopeCompanyId = recruiterCompanyId.Value;
        }

        var deleted = await _jobService.DeleteAsync(id, scopeCompanyId);

        if (!deleted)
        {
            return Failure(
                "Job not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Job deleted successfully.");
    }

    [HttpPut("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? scopeCompanyId = null;

        if (!User.IsInRole("SuperAdmin"))
        {
            var recruiterCompanyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync();

            if (!recruiterCompanyId.HasValue)
                return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

            scopeCompanyId = recruiterCompanyId.Value;
        }

        var restored = await _jobService.RestoreAsync(id, scopeCompanyId);

        if (!restored)
            return NotFound();

        return Ok(new
        {
            success = true,
            message = "Job restored successfully."
        });
    }
}
