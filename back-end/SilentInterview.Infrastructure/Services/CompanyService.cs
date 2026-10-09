using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Company;
using SilentInterview.Application.Interfaces;

using SilentInterview.Domain.Entities;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public class CompanyService : ICompanyService
{
    private readonly SilentInterviewDbContext _context;

    public CompanyService(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<CompanyDto>> GetAllAsync(
        CompanyQueryParameters parameters, Guid? scopeCompanyId)
    {
        IQueryable<Company> query = _context.Companies.AsNoTracking();

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
            query = query.Where(x => x.Id == scopeCompanyId.Value);
        }

        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim();

            query = query.Where(x =>
                x.Name.Contains(search) ||
                x.Description.Contains(search) ||
                x.Website.Contains(search) ||
                x.Industry.Contains(search));
        }

        if (!string.IsNullOrWhiteSpace(parameters.Industry))
        {
            query = query.Where(x =>
                x.Industry.Contains(parameters.Industry));
        }

        query = parameters.SortBy.ToLower() switch
        {
            "name" => parameters.Descending
                ? query.OrderByDescending(x => x.Name)
                : query.OrderBy(x => x.Name),

            "industry" => parameters.Descending
                ? query.OrderByDescending(x => x.Industry)
                : query.OrderBy(x => x.Industry),

            "website" => parameters.Descending
                ? query.OrderByDescending(x => x.Website)
                : query.OrderBy(x => x.Website),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Name)
                : query.OrderBy(x => x.Name)
        };

        var totalCount = await query.CountAsync();

        var companies = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<CompanyDto>
        {
            Items = companies.Select(ToDto).ToList(),
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize,
            TotalCount = totalCount
        };
    }

    public async Task<CompanyDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId)
    {
        if (scopeCompanyId.HasValue && scopeCompanyId.Value != id)
            return null;

        var company = await _context.Companies
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        return company == null
            ? null
            : ToDto(company);
    }

    public async Task<CompanyDto> CreateAsync(CreateCompanyRequest request, Guid recruiterUserId)
    {
        var company = new Company
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Industry = request.Industry,
            CountryCode = request.CountryCode,
            Description = request.Description,
            Website = request.Website,
            LogoUrl = request.LogoUrl
        };

        _context.Companies.Add(company);

        // Update the recruiter's CompanyId to point at the newly created company.
        // Without this, UserScopeResolver continues to return the OLD CompanyId from
        // Recruiter.CompanyId, so every subsequent Update/Delete/Restore guard
        // (scopeCompanyId != id) mismatches and returns 404. The new company is also
        // invisible on refresh because GetAll filters WHERE Companies.Id = scope.CompanyId.
        var recruiter = await _context.Recruiters
            .FirstOrDefaultAsync(r => r.UserId == recruiterUserId);

        if (recruiter != null)
        {
            recruiter.CompanyId = company.Id;
        }

        await _context.SaveChangesAsync();

        return ToDto(company);
    }

    // UPDATED (matches JobService pattern)
    public async Task<CompanyDto?> UpdateAsync(
        Guid id,
        UpdateCompanyRequest request,
        Guid? scopeCompanyId)
    {
        if (scopeCompanyId.HasValue && scopeCompanyId.Value != id)
            return null;

        var company = await _context.Companies.FindAsync(id);

        if (company == null || company.IsDeleted)
            return null;

        company.Name = request.Name;
        company.Industry = request.Industry;
        company.CountryCode = request.CountryCode;
        company.Description = request.Description;
        company.Website = request.Website;
        if (!string.IsNullOrWhiteSpace(request.LogoUrl))
            company.LogoUrl = request.LogoUrl;

        await _context.SaveChangesAsync();

        return ToDto(company);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId)
    {
        if (scopeCompanyId.HasValue && scopeCompanyId.Value != id)
            return false;

        var company = await _context.Companies.FindAsync(id);

        if (company == null || company.IsDeleted)
            return false;

        var now = DateTime.UtcNow;

        // Companies use soft-delete semantics. Cascade that state through the
        // recruiting tree so no candidate or HR page can retain interviews,
        // applications, or report links belonging to a removed company.
        var jobIds = await _context.Jobs
            .IgnoreQueryFilters()
            .Where(x => x.CompanyId == company.Id)
            .Select(x => x.Id)
            .ToListAsync();

        if (jobIds.Count > 0)
        {
            var jobs = await _context.Jobs
                .IgnoreQueryFilters()
                .Where(x => jobIds.Contains(x.Id))
                .ToListAsync();
            foreach (var job in jobs)
            {
                job.IsDeleted = true;
                job.DeletedAt = now;
            }

            var applicationIds = await _context.JobApplications
                .IgnoreQueryFilters()
                .Where(x => jobIds.Contains(x.JobId))
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
        }

        company.IsDeleted = true;
        company.DeletedAt = now;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId)
    {
        if (scopeCompanyId.HasValue && scopeCompanyId.Value != id)
            return false;

        var company = await _context.Companies
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (company == null || !company.IsDeleted)
            return false;

        company.IsDeleted = false;
        company.DeletedAt = null;

        await _context.SaveChangesAsync();

        return true;
    }

    private static CompanyDto ToDto(Company company)
    {
        return new CompanyDto
        {
            Id = company.Id,
            Name = company.Name,
            Industry = company.Industry,
            CountryCode = company.CountryCode,
            Description = company.Description,
            Website = company.Website,
            LogoUrl = company.LogoUrl
        };
    }
}