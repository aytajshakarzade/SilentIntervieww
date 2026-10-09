using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Job;

namespace SilentInterview.Application.Interfaces;

public interface IJobService
{
    Task<PagedResult<JobDto>> GetAllAsync(
        JobQueryParameters parameters, Guid? scopeCompanyId);

    Task<JobDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId);

    Task<JobDto> CreateAsync(CreateJobRequest request);

    Task<JobDto?> UpdateAsync(Guid id, UpdateJobRequest request, Guid? scopeCompanyId);
    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId);
    Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId);
}