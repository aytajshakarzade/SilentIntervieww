using SilentInterview.Application.DTOs.InterviewEvent;

namespace SilentInterview.Application.Interfaces;

public interface IInterviewTimelineService
{
    Task<IReadOnlyList<InterviewEventDto>> GetAsync(Guid interviewSessionId, CancellationToken cancellationToken = default);
    Task RecordAsync(Guid interviewSessionId, Guid? actorUserId, string type, string detail, CancellationToken cancellationToken = default);
}
