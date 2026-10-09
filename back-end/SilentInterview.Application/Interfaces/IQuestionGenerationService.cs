using SilentInterview.Application.DTOs.AI;

namespace SilentInterview.Application.Interfaces;

/// <summary>
/// Generates the AI interview structure (sections + unique questions) for a
/// session, based on job context, experience level, culture and language.
/// Replaces static/template question generation entirely.
/// </summary>
public interface IQuestionGenerationService
{
    Task<AIInterviewPlanDto> GeneratePlanAsync(
        GenerateInterviewPlanRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);

    Task<AIInterviewPlanDto?> GetPlanAsync(
        Guid interviewSessionId,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);
}
