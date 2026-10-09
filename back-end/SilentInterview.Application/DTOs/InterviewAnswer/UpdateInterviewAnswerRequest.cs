namespace SilentInterview.Application.DTOs.InterviewAnswer;

public class UpdateInterviewAnswerRequest
{
    public string Question { get; set; } = string.Empty;

    public string Answer { get; set; } = string.Empty;

    public int Order { get; set; }

    public int? TimeSpentSec { get; set; }
    public int? EyeContactPct { get; set; }
    public string? DominantEmotion { get; set; }
    public int? SpeechWpm { get; set; }
    public int? FillerWordCount { get; set; }
    public decimal? LongestPauseSec { get; set; }
}
