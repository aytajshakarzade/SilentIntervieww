using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

/// <summary>
/// The AI-generated interview structure for a single InterviewSession:
/// sectioned questions (technical / behavioral / culture_fit / problem_solving),
/// the language the interview is conducted in, and metadata about how it
/// was generated. One plan per session; questions are unique per candidate
/// because they are generated fresh from the job + candidate context.
/// </summary>
public class AIInterviewPlan : BaseEntity
{
    public Guid InterviewSessionId { get; set; }

    public InterviewSession InterviewSession { get; set; } = null!;

    public string InterviewTitle { get; set; } = string.Empty;

    /// <summary>AI-generated opening introduction the interviewer reads/shows to the candidate before Q&amp;A begins.</summary>
    public string? Introduction { get; set; }

    public string Difficulty { get; set; } = string.Empty;

    public int EstimatedDurationMinutes { get; set; }

    /// <summary>ISO 639-1 language code the interview is conducted in: "az", "en", or "ru".</summary>
    public string Language { get; set; } = "en";

    /// <summary>JSON array of sections: [{ type, questions:[{ id, text, order }] }].</summary>
    public string SectionsJson { get; set; } = "[]";

    /// <summary>The OpenRouter model string used to generate this plan.</summary>
    public string GeneratedByModel { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<AIAnswerEvaluation> AnswerEvaluations { get; set; }
        = new List<AIAnswerEvaluation>();
}
