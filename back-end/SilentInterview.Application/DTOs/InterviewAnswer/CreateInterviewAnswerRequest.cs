namespace SilentInterview.Application.DTOs.InterviewAnswer;

public class CreateInterviewAnswerRequest
{
    public Guid InterviewSessionId { get; set; }

    public string Question { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    public int Order { get; set; }

    // Optional real analytics captured client-side while this question was active.
    public int? TimeSpentSec { get; set; }
    public int? EyeContactPct { get; set; }
    public string? DominantEmotion { get; set; }
    public int? SpeechWpm { get; set; }
    public int? FillerWordCount { get; set; }
    public decimal? LongestPauseSec { get; set; }
}
