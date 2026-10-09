using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.JobApplication;

namespace SilentInterview.Application.Interfaces;

public interface IJobApplicationService
{
    Task<PagedResult<JobApplicationDto>> GetAllAsync(
        JobApplicationQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<JobApplicationDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<JobApplicationDto> CreateAsync(CreateJobApplicationRequest request);

    Task<(bool Success, string? ErrorMessage)> UpdateAsync(Guid id, UpdateJobApplicationRequest request);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);
}