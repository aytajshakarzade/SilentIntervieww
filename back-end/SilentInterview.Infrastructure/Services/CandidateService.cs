using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Candidate;
using SilentInterview.Application.Interfaces;

using SilentInterview.Domain.Entities;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class CandidateService : ICandidateService
{
    private readonly SilentInterviewDbContext _context;

    public CandidateService(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<CandidateDto>> GetAllAsync(
        CandidateQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        // Global HasQueryFilter(!IsDeleted) on the DbContext already excludes
        // soft-deleted rows by default; IgnoreQueryFilters() opts back in.
        IQueryable<Candidate> query = _context.Candidates.AsNoTracking().Include(x => x.User);

        if (parameters.OnlyDeleted)
        {
            query = query.IgnoreQueryFilters().Where(x => x.IsDeleted);
        }
        else if (parameters.IncludeDeleted)
        {
            query = query.IgnoreQueryFilters();
        }

        // Recruiters may only see candidates who have applied to their own company's jobs.
        if (scopeCompanyId.HasValue)
        {
            var candidateIdsInScope = _context.JobApplications
                .Where(a => a.Job.CompanyId == scopeCompanyId.Value)
                .Select(a => a.CandidateId)
                .Distinct();

            query = query.Where(x => candidateIdsInScope.Contains(x.Id));
        }

        // Candidates may only see their own profile.
        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.UserId == scopeCandidateUserId.Value);
        }

        // Search
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim();

            query = query.Where(x =>
                x.Skills.Contains(search) ||
                x.Education.Contains(search) ||
                x.Experience.Contains(search));
        }

        // Filter by UserId
        if (parameters.UserId.HasValue)
        {
            query = query.Where(x =>
                x.UserId == parameters.UserId.Value);
        }

        // Filter by Skill
        if (!string.IsNullOrWhiteSpace(parameters.Skill))
        {
            query = query.Where(x =>
                x.Skills.Contains(parameters.Skill));
        }

        // Sorting
        query = parameters.SortBy.ToLower() switch
        {
            "skills" => parameters.Descending
                ? query.OrderByDescending(x => x.Skills)
                : query.OrderBy(x => x.Skills),

            "education" => parameters.Descending
                ? query.OrderByDescending(x => x.Education)
                : query.OrderBy(x => x.Education),

            "experience" => parameters.Descending
                ? query.OrderByDescending(x => x.Experience)
                : query.OrderBy(x => x.Experience),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Id)
                : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();

        var candidates = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<CandidateDto>
        {
            Items = candidates.Select(ToDto).ToList(),
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize,
            TotalCount = totalCount
        };
    }

    public async Task<CandidateDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        // Global query filter already excludes soft-deleted rows.
        var query = _context.Candidates
            .AsNoTracking()
            .Include(x => x.User)
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
        {
            var candidateIdsInScope = _context.JobApplications
                .Where(a => a.Job.CompanyId == scopeCompanyId.Value)
                .Select(a => a.CandidateId)
                .Distinct();

            query = query.Where(x => candidateIdsInScope.Contains(x.Id));
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.UserId == scopeCandidateUserId.Value);
        }

        var candidate = await query.FirstOrDefaultAsync();

        return candidate == null
            ? null
            : ToDto(candidate);
    }

    public async Task<CandidateDto> CreateAsync(CreateCandidateRequest request)
    {
        var candidate = new Candidate
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            ResumeUrl = request.ResumeUrl,
            Skills = request.Skills,
            Education = request.Education,
            Experience = request.Experience
        };

        _context.Candidates.Add(candidate);

        await _context.SaveChangesAsync();

        return ToDto(candidate);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateCandidateRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId = null)
    {
        var candidate = await _context.Candidates.FindAsync(id);

        if (candidate == null || candidate.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.JobApplications
                .AnyAsync(a => a.CandidateId == id && a.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope)
                return false;
        }

        if (scopeCandidateUserId.HasValue && candidate.UserId != scopeCandidateUserId.Value)
        {
            return false;
        }

        candidate.ResumeUrl = request.ResumeUrl;
        candidate.Skills = request.Skills;
        candidate.Education = request.Education;
        candidate.Experience = request.Experience;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        var candidate = await _context.Candidates.FindAsync(id);

        if (candidate == null || candidate.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.JobApplications
                .AnyAsync(a => a.CandidateId == id && a.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope)
                return false;
        }

        if (scopeCandidateUserId.HasValue && candidate.UserId != scopeCandidateUserId.Value)
        {
            return false;
        }

        candidate.IsDeleted = true;
        candidate.DeletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null)
    {
        // The row is soft-deleted, so FindAsync's implicit query filter
        // would never locate it — go through IgnoreQueryFilters() instead.
        var candidate = await _context.Candidates
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (candidate == null || !candidate.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.JobApplications
                .AnyAsync(a => a.CandidateId == id && a.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope)
                return false;
        }

        if (scopeCandidateUserId.HasValue && candidate.UserId != scopeCandidateUserId.Value)
        {
            return false;
        }

        candidate.IsDeleted = false;
        candidate.DeletedAt = null;

        await _context.SaveChangesAsync();

        return true;
    }

    private static CandidateDto ToDto(Candidate candidate)
    {
        return new CandidateDto
        {
            Id = candidate.Id,
            UserId = candidate.UserId,
            FullName = candidate.User?.FullName ?? string.Empty,
            ResumeUrl = candidate.ResumeUrl,
            Skills = candidate.Skills,
            Education = candidate.Education,
            Experience = candidate.Experience
        };
    }
}
