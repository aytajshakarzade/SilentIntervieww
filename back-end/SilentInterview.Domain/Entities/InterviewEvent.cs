using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class InterviewEvent : BaseEntity
{
    public Guid InterviewSessionId { get; set; }
    public InterviewSession InterviewSession { get; set; } = null!;
    public Guid? ActorUserId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Detail { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
}
