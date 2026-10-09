using SilentInterview.Application.DTOs.AI;

namespace SilentInterview.Application.Interfaces;

/// <summary>
/// Produces the enterprise AI hiring report by combining the deterministic
/// signals already captured by ReportService (camera, speech, per-answer
/// metrics) with the stored AIAnswerEvaluations and full transcript, reasoning
/// over all of it via the configured report model.
/// </summary>
public interface IReportAIService
{
    Task<AIReportDto> GenerateAsync(
        GenerateAIReportRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);

    Task<AIReportDto?> GetAsync(
        Guid interviewSessionId,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default);
}
