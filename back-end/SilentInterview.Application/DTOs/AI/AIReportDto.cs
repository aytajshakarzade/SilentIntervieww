namespace SilentInterview.Application.DTOs.AI;

public sealed class GenerateAIReportRequest
{
    public Guid InterviewSessionId { get; set; }

    /// <summary>"az", "en", or "ru". Defaults to the interview plan's language, then "en".</summary>
    public string? Language { get; set; }
}

/// <summary>
/// The full enterprise HR report produced by ReportAIService, combining camera/speech/answer
/// signals already captured deterministically with AI reasoning over the full transcript.
/// </summary>
public sealed class AIReportDto
{
    public Guid ReportId { get; set; }

    public Guid InterviewSessionId { get; set; }

    public string Language { get; set; } = "en";

    public string ExecutiveSummary { get; set; } = string.Empty;

    /// <summary>"Strong Hire" | "Potential Hire" | "Needs Review" | "Reject" (or localized equivalent).</summary>
    public string HiringRecommendation { get; set; } = string.Empty;

    public string HiringRecommendationReason { get; set; } = string.Empty;

    /// <summary>
    /// True when this report was produced by the deterministic fallback path (AI generation failed).
    /// The frontend uses this to clearly distinguish AI-generated from fallback-generated reports.
    /// </summary>
    public bool IsFallback { get; set; }

    public string CandidateProfile { get; set; } = string.Empty;

    public string TechnicalAnalysis { get; set; } = string.Empty;

    public string CommunicationAnalysis { get; set; } = string.Empty;

    public string BehaviorAnalysis { get; set; } = string.Empty;

    public string LeadershipAnalysis { get; set; } = string.Empty;

    public string CultureFit { get; set; } = string.Empty;

    public string ProblemSolving { get; set; } = string.Empty;

    public List<string> Strengths { get; set; } = new();

    public List<string> Weaknesses { get; set; } = new();

    public List<string> RiskFactors { get; set; } = new();

    public string LearningPotential { get; set; } = string.Empty;

    public string SalaryEstimation { get; set; } = string.Empty;

    public string RoleMatch { get; set; } = string.Empty;

    public string NextInterviewRecommendation { get; set; } = string.Empty;

    public List<string> CustomFollowUpQuestions { get; set; } = new();

    /// <summary>
    /// 0-100. When AI-generated: AI's own confidence in this assessment.
    /// When fallback: the deterministic pass probability from the base report.
    /// Never 0% when a scoring result exists — 0% is reserved for truly no data.
    /// </summary>
    public int ConfidenceScore { get; set; }

    public string GeneratedByModel { get; set; } = string.Empty;

    public DateTime GeneratedAt { get; set; }
}
