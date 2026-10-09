using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Recruiter;
using SilentInterview.Application.Interfaces;

using SilentInterview.Domain.Entities;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class RecruiterService : IRecruiterService
{
    private readonly SilentInterviewDbContext _context;

    public RecruiterService(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<RecruiterDto>> GetAllAsync(
        RecruiterQueryParameters parameters, Guid? scopeCompanyId)
    {
        // Global HasQueryFilter(!IsDeleted) on the DbContext already excludes
        // soft-deleted rows by default; IgnoreQueryFilters() opts back in.
        IQueryable<Recruiter> query = _context.Recruiters.AsNoTracking();

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
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);
        }

        // User Filter
        if (parameters.UserId.HasValue)
        {
            query = query.Where(x =>
                x.UserId == parameters.UserId.Value);
        }

        // Company Filter (only honored when not already scoped, i.e. Admin)
        if (!scopeCompanyId.HasValue && parameters.CompanyId.HasValue)
        {
            query = query.Where(x =>
                x.CompanyId == parameters.CompanyId.Value);
        }

        // Sorting
        query = parameters.SortBy.ToLower() switch
        {
            "userid" => parameters.Descending
                ? query.OrderByDescending(x => x.UserId)
                : query.OrderBy(x => x.UserId),

            "companyid" => parameters.Descending
                ? query.OrderByDescending(x => x.CompanyId)
                : query.OrderBy(x => x.CompanyId),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Id)
                : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();

        var recruiters = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<RecruiterDto>
        {
            Items = recruiters.Select(ToDto).ToList(),
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize,
            TotalCount = totalCount
        };
    }

    public async Task<RecruiterDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId)
    {
        // Global query filter already excludes soft-deleted rows.
        var query = _context.Recruiters
            .AsNoTracking()
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
            query = query.Where(x => x.CompanyId == scopeCompanyId.Value);

        var recruiter = await query.FirstOrDefaultAsync();

        return recruiter == null
            ? null
            : ToDto(recruiter);
    }

    public async Task<RecruiterDto> CreateAsync(CreateRecruiterRequest request)
    {
        var recruiter = new Recruiter
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            CompanyId = request.CompanyId
        };

        _context.Recruiters.Add(recruiter);

        await _context.SaveChangesAsync();

        return ToDto(recruiter);
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateRecruiterRequest request,
        Guid? scopeCompanyId)
    {
        var recruiter = await _context.Recruiters.FindAsync(id);

        if (recruiter == null || recruiter.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue && recruiter.CompanyId != scopeCompanyId.Value)
            return false;

        recruiter.CompanyId = request.CompanyId;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId)
    {
        var recruiter = await _context.Recruiters.FindAsync(id);

        if (recruiter == null || recruiter.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue && recruiter.CompanyId != scopeCompanyId.Value)
            return false;

        recruiter.IsDeleted = true;
        recruiter.DeletedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId)
    {
        // The row is soft-deleted, so FindAsync's implicit query filter
        // would never locate it — go through IgnoreQueryFilters() instead.
        var recruiter = await _context.Recruiters
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (recruiter == null || !recruiter.IsDeleted)
            return false;

        if (scopeCompanyId.HasValue && recruiter.CompanyId != scopeCompanyId.Value)
            return false;

        recruiter.IsDeleted = false;
        recruiter.DeletedAt = null;

        await _context.SaveChangesAsync();

        return true;
    }

    private static RecruiterDto ToDto(Recruiter recruiter)
    {
        return new RecruiterDto
        {
            Id = recruiter.Id,
            UserId = recruiter.UserId,
            CompanyId = recruiter.CompanyId
        };
    }
}
