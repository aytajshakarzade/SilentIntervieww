using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Candidate;

namespace SilentInterview.Application.Interfaces;

public interface ICandidateService
{
    Task<PagedResult<CandidateDto>> GetAllAsync(
        CandidateQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<CandidateDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<CandidateDto> CreateAsync(CreateCandidateRequest request);

    Task<bool> UpdateAsync(Guid id, UpdateCandidateRequest request, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<bool> RestoreAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);
}