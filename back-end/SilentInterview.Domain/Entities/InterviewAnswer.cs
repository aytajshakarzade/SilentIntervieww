using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class InterviewAnswer : BaseEntity
{
    public Guid InterviewSessionId { get; set; }

    public InterviewSession InterviewSession { get; set; } = null!;

    public string Question { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    public int Order { get; set; }

    // ── Optional per-question analytics captured live during the interview.
    // Nullable so answers recorded before this migration remain valid. ──

    /// <summary>Seconds spent on this question (from question shown to answer saved).</summary>
    public int? TimeSpentSec { get; set; }

    /// <summary>Average eye-contact percentage (0-100) measured while this question was active.</summary>
    public int? EyeContactPct { get; set; }

    /// <summary>Dominant detected emotion label while this question was active.</summary>
    public string? DominantEmotion { get; set; }

    /// <summary>Speech pace in words-per-minute for this answer.</summary>
    public int? SpeechWpm { get; set; }

    /// <summary>Filler word count detected in this answer.</summary>
    public int? FillerWordCount { get; set; }

    /// <summary>Longest pause in seconds detected while answering this question.</summary>
    public decimal? LongestPauseSec { get; set; }

    /// <summary>Derived confidence score 0-100 for this answer (from eye contact + emotion + pacing signals).</summary>
    public int? ConfidenceScore { get; set; }

    /// <summary>Derived overall quality score 0-100 for this answer.</summary>
    public int? QualityScore { get; set; }

    // ── Extended text-derived analytics. All computed deterministically
    // from Answer text (and, for Grammar, the LanguageTool public API)
    // at save time. Nullable so pre-migration rows remain valid. ──

    /// <summary>Grammar score 0-100 from LanguageTool (100 - weighted error density). Null if LanguageTool was unreachable for this answer.</summary>
    public int? GrammarScore { get; set; }

    /// <summary>Raw count of LanguageTool-flagged issues in this answer.</summary>
    public int? GrammarIssueCount { get; set; }

    /// <summary>STAR framework coverage score 0-100 for this answer (25 pts per component detected: Situation, Task, Action, Result).</summary>
    public int? StarScore { get; set; }

    /// <summary>Which STAR components were detected, e.g. "SAR" (Situation, Action, Result found; Task not found).</summary>
    public string? StarComponentsDetected { get; set; }
}