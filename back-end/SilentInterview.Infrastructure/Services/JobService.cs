using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Job;
using SilentInterview.Application.Interfaces;

using SilentInterview.Domain.Entities;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class JobService : IJobService
{
    private readonly SilentInterviewDbContext _context;

    public JobService(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<JobDto>> GetAllAsync(
        JobQueryParameters parameters, Guid? scopeCompanyId)
    {
        // Global HasQueryFilter(!IsDeleted) on the DbContext already excludes
        // soft-deleted rows by default, so IgnoreQueryFilters() is needed
        // whenever the caller wants deleted rows back in view.
        IQueryable<Job> query = _context.Jobs
     .Include(x => x.Company)
     .AsNoTracking();

        if (parameters.OnlyDeleted)
        {
            query = query.IgnoreQueryFilters().Where(x => x.IsDeleted);
        }
        else if (parameters.IncludeDeleted)
        {
            query = query.IgnoreQueryFilters();
        }

        // ============================
        // Search
        // ============================

        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim();

            query = query.Where(x =>
                x.Title.Contains(search) ||
                x.Description.Contains(search) ||
                x.Requirements.Contains(search));
        }

        // ============================
        // Company Scope (authenticated user's company; never trust client-supplied filter to widen scope)
        // ============================

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);
        }
        else if (parameters.CompanyId.HasValue)
        {
            // Only allowed when caller is not scoped (e.g. Admin) or public candidate browsing.
            query = query.Where(x => x.CompanyId == parameters.CompanyId.Value);
        }

        // ============================
        // Salary Filter
        // ============================

        if (parameters.MinSalary.HasValue)
        {
            query = query.Where(x =>
                x.Salary >= parameters.MinSalary.Value);
        }

        if (parameters.MaxSalary.HasValue)
        {
            query = query.Where(x =>
                x.Salary <= parameters.MaxSalary.Value);
        }

        // ============================
        // Sorting
        // ============================

        query = parameters.SortBy.ToLower() switch
        {
            "salary" => parameters.Descending
                ? query.OrderByDescending(x => x.Salary)
                : query.OrderBy(x => x.Salary),

            "title" => parameters.Descending
                ? query.OrderByDescending(x => x.Title)
                : query.OrderBy(x => x.Title),

            _ => query.OrderBy(x => x.Title)
        };

        // ============================
        // Pagination
        // ============================

        var totalCount = await query.CountAsync();

        var jobs = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<JobDto>
        {
            Items = jobs.Select(ToDto).ToList(),

            PageNumber = parameters.PageNumber,

            PageSize = parameters.PageSize,

            TotalCount = totalCount
        };
    }

    public async Task<JobDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId)
    {
        // Global query filter already excludes soft-deleted rows.
        var query = _context.Jobs
            .Include(x => x.Company)
            .AsNoTracking()
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);

        var job = await query.FirstOrDefaultAsync();
        return job == null
            ? null
            : ToDto(job);
    }

    public async Task<JobDto> CreateAsync(CreateJobRequest request)
    {
        var job = new Job
        {
            Id = Guid.NewGuid(),
            CompanyId = request.CompanyId,
            Title = request.Title,
            Description = request.Description,
            Requirements = request.Requirements,
            Salary = request.Salary,
            Experience = request.Experience,
            Skills = request.Skills,
            Difficulty = request.Difficulty,
            Language = request.Language,
            EstimatedDuration = request.EstimatedDuration,
            Culture = request.Culture
        };

        _context.Jobs.Add(job);

        await _context.SaveChangesAsync();

        await _context.Entry(job)
            .Reference(x => x.Company)
            .LoadAsync();

        return ToDto(job);
    }

    public async Task<JobDto?> UpdateAsync(
       Guid id,
       UpdateJobRequest request,
       Guid? scopeCompanyId)
    {
        var query = _context.Jobs
            .Include(x => x.Company)
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);

        var job = await query.FirstOrDefaultAsync();
        if (job == null)
            return null;

        job.CompanyId = request.CompanyId;
        job.Title = request.Title;
        job.Description = request.Description;
        job.Requirements = request.Requirements;
        job.Salary = request.Salary;
        job.Experience = request.Experience;
        job.Skills = request.Skills;
        job.Difficulty = request.Difficulty;
        job.Language = request.Language;
        job.EstimatedDuration = request.EstimatedDuration;
        job.Culture = request.Culture;

        await _context.SaveChangesAsync();

        await _context.Entry(job)
            .Reference(x => x.Company)
            .LoadAsync();

        return ToDto(job);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId)
    {
        var query = _context.Jobs
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);

        var job = await query.FirstOrDefaultAsync();
        if (job == null)
            return false;

        var now = DateTime.UtcNow;

        // A job is soft-deleted, so SQL Server cannot cascade the delete for us.
        // Explicitly soft-delete every application and interview session linked
        // to this job as well. This keeps recruiter and candidate views in sync
        // and prevents stale interview/report links after a job is removed.
        var applicationIds = await _context.JobApplications
            .IgnoreQueryFilters()
            .Where(x => x.JobId == job.Id)
            .Select(x => x.Id)
            .ToListAsync();

        if (applicationIds.Count > 0)
        {
            var applications = await _context.JobApplications
                .IgnoreQueryFilters()
                .Where(x => applicationIds.Contains(x.Id))
                .ToListAsync();
            foreach (var application in applications)
            {
                application.IsDeleted = true;
                application.DeletedAt = now;
            }

            var sessions = await _context.InterviewSessions
                .IgnoreQueryFilters()
                .Where(x => applicationIds.Contains(x.JobApplicationId))
                .ToListAsync();
            foreach (var session in sessions)
            {
                session.IsDeleted = true;
                session.DeletedAt = now;
            }
        }

        job.IsDeleted = true;
        job.DeletedAt = now;

        await _context.SaveChangesAsync();

        return true;
    }
    public async Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId)
    {
        // Row is soft-deleted, so the global filter must be bypassed to find it.
        var query = _context.Jobs
            .IgnoreQueryFilters()
            .Where(x => x.Id == id && x.IsDeleted);

        if (scopeCompanyId.HasValue)
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);

        var job = await query.FirstOrDefaultAsync();

        if (job == null)
            return false;

        job.IsDeleted = false;
        job.DeletedAt = null;

        await _context.SaveChangesAsync();

        return true;
    }

    private static JobDto ToDto(Job job)
    {
        return new JobDto
        {
            Id = job.Id,
            CompanyId = job.CompanyId,
            CompanyName = job.Company?.Name ?? "",
            Title = job.Title,
            Description = job.Description,
            Requirements = job.Requirements,
            Salary = job.Salary,
            Experience = job.Experience,
            Skills = job.Skills,
            Difficulty = job.Difficulty,
            Language = job.Language,
            EstimatedDuration = job.EstimatedDuration,
            Culture = job.Culture
        };
    }
}
