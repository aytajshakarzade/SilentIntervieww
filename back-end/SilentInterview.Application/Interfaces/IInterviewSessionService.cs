using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.InterviewSession;

namespace SilentInterview.Application.Interfaces;

public interface IInterviewSessionService
{
    Task<PagedResult<InterviewSessionDto>> GetAllAsync(
        InterviewSessionQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<InterviewSessionDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<InterviewSessionDto> CreateAsync(CreateInterviewSessionRequest request);

    Task<bool> UpdateAsync(Guid id, UpdateInterviewSessionRequest request);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId);
}