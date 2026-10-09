using SilentInterview.Application.DTOs.AI;

namespace SilentInterview.Application.Interfaces;

/// <summary>
/// Drives the live, adaptive interview: analyzes each submitted answer and
/// decides what happens next (ask a deeper follow-up, ask a clarification,
/// or move to the next planned question) — replacing static question order.
/// </summary>
public interface IInterviewAIService
{
    /// <summary>Analyzes a single submitted answer: correctness, confidence, depth,
    /// communication and technical understanding, and stores the evaluation.</summary>
    Task<AnswerEvaluationDto> EvaluateAnswerAsync(
        EvaluateAnswerRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);

    /// <summary>Returns the next question the AI interviewer should ask: either a dynamically
    /// generated follow-up (based on the most recent answer evaluation) or the next planned
    /// question from the session's AIInterviewPlan. Returns InterviewComplete=true once the
    /// plan is exhausted and no further follow-up is warranted.</summary>
    Task<NextQuestionDto> GetNextQuestionAsync(
        NextQuestionRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);
}
