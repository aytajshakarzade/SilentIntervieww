namespace SilentInterview.Application.DTOs.InterviewAnswer;

public class InterviewAnswerDto
{
    public Guid Id { get; set; }

    public Guid InterviewSessionId { get; set; }

    public string Question { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? TimeSpentSec { get; set; }
    public int? EyeContactPct { get; set; }
    public string? DominantEmotion { get; set; }
    public int? SpeechWpm { get; set; }
    public int? FillerWordCount { get; set; }
    public decimal? LongestPauseSec { get; set; }
    public int? ConfidenceScore { get; set; }
    public int? QualityScore { get; set; }
    public int? GrammarScore { get; set; }
    public int? GrammarIssueCount { get; set; }
    public int? StarScore { get; set; }
    public string? StarComponentsDetected { get; set; }
}
