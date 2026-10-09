using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.JobApplication;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Enums;

using SilentInterview.Domain.Entities;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class JobApplicationService : IJobApplicationService
{
    private readonly SilentInterviewDbContext _context;

    public JobApplicationService(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<JobApplicationDto>> GetAllAsync(
        JobApplicationQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        // Global HasQueryFilter(!IsDeleted) on the DbContext already excludes
        // soft-deleted rows by default; IgnoreQueryFilters() opts back in.
        IQueryable<JobApplication> query = _context.JobApplications
    .Include(x => x.Candidate)
        .ThenInclude(x => x.User)
    .Include(x => x.Job)
    .AsNoTracking();

        if (parameters.OnlyDeleted)
        {
            query = query.IgnoreQueryFilters().Where(x => x.IsDeleted);
        }
        else if (parameters.IncludeDeleted)
        {
            query = query.IgnoreQueryFilters();
        }

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.Candidate.UserId == scopeCandidateUserId.Value);
        }

        // Search — status is now an enum column, so we match it by parsing
        // the search term to ApplicationStatus rather than a substring scan
        // (substring matching against an enum-backed column isn't
        // translatable the same way, and each application has exactly one
        // status value, not a superstring to search within).
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim();
            var searchStatus = NormalizeStatus(search);

            query = searchStatus.HasValue
                ? query.Where(x => x.Status == searchStatus.Value)
                : query.Where(x => false);
        }

        // Candidate filter
        if (parameters.CandidateId.HasValue)
        {
            query = query.Where(x =>
                x.CandidateId == parameters.CandidateId.Value);
        }

        // Job filter
        if (parameters.JobId.HasValue)
        {
            query = query.Where(x =>
                x.JobId == parameters.JobId.Value);
        }

        // Status filter
        if (!string.IsNullOrWhiteSpace(parameters.Status))
        {
            var filterStatus = NormalizeStatus(parameters.Status);

            query = filterStatus.HasValue
                ? query.Where(x => x.Status == filterStatus.Value)
                : query.Where(x => false);
        }

        // Sorting
        query = parameters.SortBy.ToLower() switch
        {
            "candidateid" => parameters.Descending
                ? query.OrderByDescending(x => x.CandidateId)
                : query.OrderBy(x => x.CandidateId),

            "jobid" => parameters.Descending
                ? query.OrderByDescending(x => x.JobId)
                : query.OrderBy(x => x.JobId),

            // Sort by the enum's string form (not its ordinal) to preserve
            // the previous alphabetical-by-status-name ordering behavior.
            "status" => parameters.Descending
                ? query.OrderByDescending(x => x.Status.ToString())
                : query.OrderBy(x => x.Status.ToString()),

            "appliedat" => parameters.Descending
                ? query.OrderByDescending(x => x.AppliedAt)
                : query.OrderBy(x => x.AppliedAt),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Id)
                : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<JobApplicationDto>
        {
            Items = items.Select(ToDto).ToList(),
            TotalCount = totalCount,
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize
        };
    }

    public async Task<JobApplicationDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        // Global query filter already excludes soft-deleted rows.
        var query = _context.JobApplications
    .Include(x => x.Candidate)
        .ThenInclude(x => x.User)
    .Include(x => x.Job)
    .AsNoTracking()
    .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var entity = await query.FirstOrDefaultAsync();

        return entity == null ? null : ToDto(entity);
    }

    public async Task<JobApplicationDto> CreateAsync(
        CreateJobApplicationRequest request)
    {
        // Global query filter already excludes soft-deleted rows.
        var existing = await _context.JobApplications
            .AsNoTracking()
            .Where(application => application.CandidateId == request.CandidateId
                && application.JobId == request.JobId)
            .Select(application => application.Id)
            .FirstOrDefaultAsync();
        if (existing != Guid.Empty)
            return await GetByIdAsync(existing, null, null)
                ?? throw new InvalidOperationException("Existing job application could not be loaded.");

        var entity = new JobApplication
        {
            Id = Guid.NewGuid(),
            CandidateId = request.CandidateId,
            JobId = request.JobId,
            AppliedAt = DateTime.UtcNow,
            Status = ApplicationStatus.Applied
        };

        _context.JobApplications.Add(entity);

        await _context.SaveChangesAsync();

        return await GetByIdAsync(entity.Id, null, null)
               ?? throw new Exception("Job application not found after creation.");
    }

    public async Task<(bool Success, string? ErrorMessage)> UpdateAsync(
        Guid id,
        UpdateJobApplicationRequest request)
    {
        var entity = await _context.JobApplications.FindAsync(id);

        if (entity == null || entity.IsDeleted)
            return (false, "Application not found.");

        var nextStatus = NormalizeStatus(request.Status);
        if (nextStatus is null)
            return (false, $"Invalid status: {request.Status}");

        if (!CanTransition(entity.Status, nextStatus.Value))
        {
            var available = GetAvailableNextStatuses(entity.Status)
                .Select(s => s.ToString())
                .ToList();
            return (false, $"Cannot transition from {entity.Status} to {nextStatus.Value}. Available statuses: {string.Join(", ", available)}");
        }

        entity.Status = nextStatus.Value;

        await _context.SaveChangesAsync();

        return (true, null);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        var entity = await _context.JobApplications.FindAsync(id);

        if (entity == null || entity.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue || scopeCandidateUserId.HasValue)
        {
            var inScopeQuery = _context.JobApplications
                .AsNoTracking()
                .Where(x => x.Id == id);

            if (scopeCompanyId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.Job.CompanyId == scopeCompanyId.Value);
            if (scopeCandidateUserId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.Candidate.UserId == scopeCandidateUserId.Value);

            if (!await inScopeQuery.AnyAsync())
                return false;
        }

        entity.IsDeleted = true;
        entity.DeletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        // The row is soft-deleted, so FindAsync's implicit query filter
        // would never locate it — go through IgnoreQueryFilters() instead.
        var entity = await _context.JobApplications
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (entity == null || !entity.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue || scopeCandidateUserId.HasValue)
        {
            var inScopeQuery = _context.JobApplications
                .AsNoTracking()
                .Where(x => x.Id == id);

            if (scopeCompanyId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.Job.CompanyId == scopeCompanyId.Value);
            if (scopeCandidateUserId.HasValue)
                inScopeQuery = inScopeQuery.Where(x => x.Candidate.UserId == scopeCandidateUserId.Value);

            if (!await inScopeQuery.AnyAsync())
                return false;
        }

        entity.IsDeleted = false;
        entity.DeletedAt = null;

        await _context.SaveChangesAsync();

        return true;
    }

    private static JobApplicationDto ToDto(JobApplication entity)
    {
        return new JobApplicationDto
        {
            Id = entity.Id,
            CandidateId = entity.CandidateId,
            CandidateName = entity.Candidate.User.FullName,
            JobId = entity.JobId,
            JobTitle = entity.Job.Title,
            AppliedAt = entity.AppliedAt,
            // API contract unchanged: Status is still serialized as a string.
            Status = entity.Status.ToString(),
            AvailableNextStatuses = GetAvailableNextStatuses(entity.Status)
                .Select(status => status.ToString())
                .ToList()
        };
    }

    // Accepts legacy/alias spellings (e.g. "Pending", "Hired", "Shortlisted",
    // free-text casing) coming in over the API and maps them onto the
    // canonical ApplicationStatus values used for transition logic.
    private static ApplicationStatus? NormalizeStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status)) return null;
        return status.Trim().ToLowerInvariant() switch
        {
            "pending" or "applied" => ApplicationStatus.Applied,
            "reviewing" or "screening" => ApplicationStatus.Screening,
            "interviewscheduled" or "interview scheduled" => ApplicationStatus.InterviewScheduled,
            "interviewstarted" or "interview started" => ApplicationStatus.InterviewStarted,
            "interviewcompleted" or "interview completed" or "completed" => ApplicationStatus.InterviewCompleted,
            "shortlisted" or "reviewpending" or "review pending" => ApplicationStatus.ReviewPending,
            "accepted" => ApplicationStatus.Accepted,
            "offersent" or "offer sent" => ApplicationStatus.OfferSent,
            "rejected" => ApplicationStatus.Rejected,
            "archived" => ApplicationStatus.Archived,
            "hired" => ApplicationStatus.Accepted,
            _ => null
        };
    }

    private static bool CanTransition(ApplicationStatus current, ApplicationStatus next)
    {
        var normalizedCurrent = NormalizeStatus(current.ToString()) ?? current;
        if (normalizedCurrent == next) return true;

        return normalizedCurrent switch
        {
            ApplicationStatus.Applied => next is ApplicationStatus.Screening or ApplicationStatus.InterviewScheduled or ApplicationStatus.Rejected or ApplicationStatus.Archived,
            ApplicationStatus.Screening => next is ApplicationStatus.InterviewScheduled or ApplicationStatus.Rejected or ApplicationStatus.Archived,
            ApplicationStatus.InterviewScheduled => next is ApplicationStatus.InterviewStarted or ApplicationStatus.Rejected or ApplicationStatus.Archived,
            ApplicationStatus.InterviewStarted => next is ApplicationStatus.InterviewCompleted or ApplicationStatus.Archived,
            ApplicationStatus.InterviewCompleted => next is ApplicationStatus.ReviewPending or ApplicationStatus.Accepted or ApplicationStatus.Rejected or ApplicationStatus.Archived,
            ApplicationStatus.ReviewPending => next is ApplicationStatus.Accepted or ApplicationStatus.OfferSent or ApplicationStatus.Rejected or ApplicationStatus.Archived,
            ApplicationStatus.Accepted => next is ApplicationStatus.OfferSent or ApplicationStatus.Archived,
            ApplicationStatus.OfferSent => next is ApplicationStatus.Archived,
            _ => false
        };
    }

    private static IReadOnlyList<ApplicationStatus> GetAvailableNextStatuses(ApplicationStatus current)
    {
        var normalizedCurrent = NormalizeStatus(current.ToString()) ?? current;
        return normalizedCurrent switch
        {
            ApplicationStatus.Applied => [ApplicationStatus.Screening, ApplicationStatus.InterviewScheduled, ApplicationStatus.Rejected, ApplicationStatus.Archived],
            ApplicationStatus.Screening => [ApplicationStatus.InterviewScheduled, ApplicationStatus.Rejected, ApplicationStatus.Archived],
            ApplicationStatus.InterviewScheduled => [ApplicationStatus.InterviewStarted, ApplicationStatus.Rejected, ApplicationStatus.Archived],
            ApplicationStatus.InterviewStarted => [ApplicationStatus.InterviewCompleted, ApplicationStatus.Archived],
            ApplicationStatus.InterviewCompleted => [ApplicationStatus.ReviewPending, ApplicationStatus.Accepted, ApplicationStatus.Rejected, ApplicationStatus.Archived],
            ApplicationStatus.ReviewPending => [ApplicationStatus.Accepted, ApplicationStatus.OfferSent, ApplicationStatus.Rejected, ApplicationStatus.Archived],
            ApplicationStatus.Accepted => [ApplicationStatus.OfferSent, ApplicationStatus.Archived],
            ApplicationStatus.OfferSent => [ApplicationStatus.Archived],
            _ => []
        };
    }
}
