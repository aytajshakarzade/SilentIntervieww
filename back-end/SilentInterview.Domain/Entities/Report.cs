namespace SilentInterview.Domain.Entities;

public class Report
{
    public Guid Id { get; set; }

    public Guid InterviewSessionId { get; set; }

    public InterviewSession InterviewSession { get; set; } = null!;

    public int Score { get; set; }

    public string Feedback { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ── Extended analytics (all nullable/optional so existing reports created
    // before this migration continue to deserialize and render correctly) ──

    /// <summary>JSON object of available named skill/session indicators (0-100). Individual indicators may be omitted when the available recorded data does not support a meaningful value.</summary>
    public string? SkillBreakdownJson { get; set; }

    /// <summary>JSON array of per-question analysis objects (question, answer, timeSpentSec, confidence, eyeContact, emotion, speechSpeedWpm, qualityScore, suggestions).</summary>
    public string? TimelineJson { get; set; }

    /// <summary>JSON object: emotion label -> percentage of session, plus a chronological sample list for the timeline chart. Derived from the real client-captured emotion history.</summary>
    public string? EmotionAnalysisJson { get; set; }

    /// <summary>JSON object: average eye-contact %, chronological samples, recommendations. Derived from the real client-captured eye-contact session.</summary>
    public string? EyeContactAnalysisJson { get; set; }

    /// <summary>JSON object: words-per-minute, filler words, longest/average pause, clarity, fluency, speaking confidence. Derived from real recorded speech analytics.</summary>
    public string? SpeechAnalysisJson { get; set; }

    /// <summary>JSON array of auto-generated strengths (strings), derived deterministically from the metrics above.</summary>
    public string? StrengthsJson { get; set; }

    /// <summary>JSON array of auto-generated weaknesses (strings), derived deterministically from the metrics above.</summary>
    public string? WeaknessesJson { get; set; }

    /// <summary>JSON array of auto-generated, personalized recommendations (strings).</summary>
    public string? RecommendationsJson { get; set; }

    /// <summary>Letter grade derived from Score (A/B/C/D/F).</summary>
    public string? Grade { get; set; }

    /// <summary>Estimated pass probability 0-100, derived from Score and sub-metrics.</summary>
    public int? PassProbability { get; set; }

    /// <summary>Hiring recommendation label derived deterministically (e.g. "Strong Hire", "Hire", "Borderline", "No Hire").</summary>
    public string? HiringRecommendation { get; set; }

    /// <summary>Professional narrative paragraph summarizing the interview, generated deterministically from the recorded metrics.</summary>
    public string? AiSummary { get; set; }

    /// <summary>JSON object: STAR framework breakdown (average Situation/Task/Action/Result coverage across answers, plus per-question detected components). Derived from real InterviewAnswer.StarScore/StarComponentsDetected values.</summary>
    public string? StarAnalysisJson { get; set; }

    /// <summary>JSON object: grammar analysis (average score, total issue count, per-question breakdown). Derived from real LanguageTool results stored per InterviewAnswer.</summary>
    public string? GrammarAnalysisJson { get; set; }

    /// <summary>JSON array: improvement roadmap items (ordered, actionable), derived deterministically from the lowest-scoring metrics.</summary>
    public string? ImprovementRoadmapJson { get; set; }

    // ── AI-generated enterprise HR report fields (populated by ReportAIService).
    // All null until AI generation runs; the deterministic fields above remain
    // as input signals / fallback so existing reports keep working. ──

    /// <summary>Full enterprise HR report JSON: executiveSummary, hiringRecommendation, hiringRecommendationReason,
    /// candidateProfile, technicalAnalysis, communicationAnalysis, behaviorAnalysis, leadershipAnalysis,
    /// cultureFit, problemSolving, strengths[], weaknesses[], riskFactors[], learningPotential,
    /// salaryEstimation, roleMatch, nextInterviewRecommendation, customFollowUpQuestions[], confidenceScore.</summary>
    public string? AiReportJson { get; set; }

    /// <summary>ISO 639-1 language code the AI report was generated in: "az", "en", or "ru".</summary>
    public string? AiReportLanguage { get; set; }

    /// <summary>The OpenRouter model string used to generate AiReportJson.</summary>
    public string? AiReportGeneratedByModel { get; set; }

    /// <summary>When the AI report was last (re)generated.</summary>
    public DateTime? AiReportGeneratedAt { get; set; }
}