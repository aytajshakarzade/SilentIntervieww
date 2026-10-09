using SilentInterview.Domain.Common;
using SilentInterview.Domain.Enums;

namespace SilentInterview.Domain.Entities;

public class JobApplication : AuditableEntity
{
    public Guid CandidateId { get; set; }

    public Guid JobId { get; set; }

    public DateTime AppliedAt { get; set; } = DateTime.UtcNow;

    public ApplicationStatus Status { get; set; } = ApplicationStatus.Applied;

    public Candidate Candidate { get; set; } = null!;

    public Job Job { get; set; } = null!;

    public ICollection<InterviewSession> InterviewSessions { get; set; } = new List<InterviewSession>();
}