using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Recruiter;

namespace SilentInterview.Application.Interfaces;

public interface IRecruiterService
{
    Task<PagedResult<RecruiterDto>> GetAllAsync(
        RecruiterQueryParameters parameters, Guid? scopeCompanyId);

    Task<RecruiterDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId);

    Task<RecruiterDto> CreateAsync(CreateRecruiterRequest request);

    Task<bool> UpdateAsync(Guid id, UpdateRecruiterRequest request, Guid? scopeCompanyId);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId);

    Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId);
}