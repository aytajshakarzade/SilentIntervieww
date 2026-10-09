using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class InterviewSession : BaseEntity
{
    /// <summary>Soft-delete marker used when the parent job/company is removed.</summary>
    public bool IsDeleted { get; set; }

    /// <summary>UTC timestamp at which this interview was hidden from normal views.</summary>
    public DateTime? DeletedAt { get; set; }

    public Guid JobApplicationId { get; set; }

    public JobApplication JobApplication { get; set; } = null!;

    public DateTime StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    /// <summary>"az", "en", or "ru". The language selected for this interview session.</summary>
    public string? Language { get; set; }

    public ICollection<InterviewAnswer> Answers { get; set; }
        = new List<InterviewAnswer>();

    public ICollection<InterviewEvent> Events { get; set; }
        = new List<InterviewEvent>();

    public Report? Report { get; set; }

    /// <summary>The AI-generated interview structure (sections/questions/language) for this session, if any.</summary>
    public AIInterviewPlan? AIInterviewPlan { get; set; }
}
