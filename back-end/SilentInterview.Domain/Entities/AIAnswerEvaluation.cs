using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

/// <summary>
/// AI-generated evaluation of a single candidate answer. Produced by
/// InterviewAIService immediately after an answer is submitted, and used
/// both to decide the next question (continue deeper / clarify / move on)
/// and later as an input signal to ReportAIService.
/// </summary>
public class AIAnswerEvaluation : BaseEntity
{
    public Guid InterviewAnswerId { get; set; }

    public InterviewAnswer InterviewAnswer { get; set; } = null!;

    public Guid AIInterviewPlanId { get; set; }

    public AIInterviewPlan AIInterviewPlan { get; set; } = null!;

    /// <summary>0-100. How technically/factually correct the answer is.</summary>
    public int TechnicalAccuracy { get; set; }

    /// <summary>0-100. Clarity, structure and articulation of the answer.</summary>
    public int CommunicationScore { get; set; }

    /// <summary>0-100. AI-perceived confidence conveyed in the answer's language.</summary>
    public int ConfidenceScore { get; set; }

    /// <summary>0-100. How clear and unambiguous the answer is.</summary>
    public int ClarityScore { get; set; }

    /// <summary>0-100. Depth/thoroughness of the answer.</summary>
    public int DepthScore { get; set; }

    /// <summary>JSON array of strings: key technical/domain terms detected in the answer.</summary>
    public string KeywordsDetectedJson { get; set; } = "[]";

    /// <summary>JSON array of strings: strengths identified in this specific answer.</summary>
    public string StrengthsJson { get; set; } = "[]";

    /// <summary>JSON array of strings: weaknesses identified in this specific answer.</summary>
    public string WeaknessesJson { get; set; } = "[]";

    /// <summary>Whether the AI decided a follow-up/clarification question is warranted.</summary>
    public bool FollowUpNeeded { get; set; }

    /// <summary>Short natural-language AI comment on this answer, in the interview's language.</summary>
    public string AiComment { get; set; } = string.Empty;

    /// <summary>The AI's chosen next action: "continue_deeper" | "clarify" | "move_next".</summary>
    public string NextAction { get; set; } = "move_next";

    /// <summary>The follow-up question text the AI generated, if any.</summary>
    public string? FollowUpQuestion { get; set; }

    /// <summary>The OpenRouter model string used to produce this evaluation.</summary>
    public string GeneratedByModel { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
