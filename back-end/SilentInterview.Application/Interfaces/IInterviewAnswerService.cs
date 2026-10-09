using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.InterviewAnswer;

namespace SilentInterview.Application.Interfaces;

public interface IInterviewAnswerService
{
    Task<PagedResult<InterviewAnswerDto>> GetAllAsync(
        InterviewAnswerQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<InterviewAnswerDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<InterviewAnswerDto> CreateAsync(CreateInterviewAnswerRequest request);

    Task<bool> UpdateAsync(Guid id, UpdateInterviewAnswerRequest request, Guid? scopeCompanyId, Guid? scopeCandidateUserId);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId);
}