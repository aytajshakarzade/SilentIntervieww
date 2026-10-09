using Microsoft.AspNetCore.Mvc;

namespace SilentInterview.Api.Controllers.Base.Scoping;

/// <summary>
/// Answers "can this authenticated user reach this interview session".
/// Extracted from the near-identical CanAccessSessionAsync (InterviewAnswerController) and
/// CanAccessAsync (InterviewTimelineController) implementations.
/// </summary>
public interface IInterviewSessionAccessGuard
{
    /// <summary>
    /// SuperAdmins: any session. Candidates: only sessions belonging to their own job application.
    /// Recruiters: only sessions whose job belongs to their own company.
    /// </summary>
    Task<bool> CanAccessAsync(ControllerBase controller, Guid sessionId, Guid userId, CancellationToken cancellationToken = default);
}
