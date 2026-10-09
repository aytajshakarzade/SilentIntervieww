namespace SilentInterview.Application.DTOs.Report;

public class ReportDto
{
    public Guid Id { get; set; }

    public Guid InterviewSessionId { get; set; }

    public int Score { get; set; }

    public string Feedback { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    public string? Grade { get; set; }

    public int? PassProbability { get; set; }

    public string? HiringRecommendation { get; set; }

    public string? AiSummary { get; set; }

    public Dictionary<string, int>? SkillBreakdown { get; set; }

    public List<ReportTimelineEntryDto>? Timeline { get; set; }

    public ReportEmotionAnalysisDto? EmotionAnalysis { get; set; }

    public ReportEyeContactAnalysisDto? EyeContactAnalysis { get; set; }

    public ReportSpeechAnalysisDto? SpeechAnalysis { get; set; }

    public List<string>? Strengths { get; set; }

    public List<string>? Weaknesses { get; set; }

    public List<string>? Recommendations { get; set; }

    public ReportStarAnalysisDto? StarAnalysis { get; set; }

    public ReportGrammarAnalysisDto? GrammarAnalysis { get; set; }

    public List<string>? ImprovementRoadmap { get; set; }
}

public class ReportTimelineEntryDto
{
    public int Order { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Answer { get; set; } = string.Empty;
    public int? TimeSpentSec { get; set; }
    public int? Confidence { get; set; }
    public int? EyeContactPct { get; set; }
    public string? Emotion { get; set; }
    public int? SpeechWpm { get; set; }
    public int? QualityScore { get; set; }
    public int? GrammarScore { get; set; }
    public int? StarScore { get; set; }
    public string? StarComponentsDetected { get; set; }
    public List<string> Suggestions { get; set; } = new();
}

public class ReportEmotionAnalysisDto
{
    public Dictionary<string, int> Percentages { get; set; } = new();
    public string? DominantEmotion { get; set; }
    public List<ReportEmotionSampleDto> Timeline { get; set; } = new();
}

public class ReportEmotionSampleDto
{
    public int QuestionOrder { get; set; }
    public string Emotion { get; set; } = string.Empty;
}

public class ReportEyeContactAnalysisDto
{
    public int AverageEyeContactPct { get; set; }
    public List<ReportEyeContactSampleDto> Timeline { get; set; } = new();
    public List<string> Recommendations { get; set; } = new();
}

public class ReportEyeContactSampleDto
{
    public int QuestionOrder { get; set; }
    public int EyeContactPct { get; set; }
}

public class ReportSpeechAnalysisDto
{
    public int WordsPerMinute { get; set; }
    public int FillerWordCount { get; set; }
    public decimal LongestPauseSec { get; set; }
    public decimal AveragePauseSec { get; set; }
    public int Clarity { get; set; }
    public int Fluency { get; set; }
    public int SpeakingConfidence { get; set; }
}

public class ReportStarAnalysisDto
{
    public int AverageScore { get; set; }
    public int SituationCoveragePct { get; set; }
    public int TaskCoveragePct { get; set; }
    public int ActionCoveragePct { get; set; }
    public int ResultCoveragePct { get; set; }
    public List<ReportStarSampleDto> Timeline { get; set; } = new();
}

public class ReportStarSampleDto
{
    public int QuestionOrder { get; set; }
    public int Score { get; set; }
    public string ComponentsDetected { get; set; } = string.Empty;
}

public class ReportGrammarAnalysisDto
{
    public int AverageScore { get; set; }
    public int TotalIssueCount { get; set; }
    public int AnsweredWithGrammarDataCount { get; set; }
    public List<ReportGrammarSampleDto> Timeline { get; set; } = new();
}

public class ReportGrammarSampleDto
{
    public int QuestionOrder { get; set; }
    public int Score { get; set; }
    public int IssueCount { get; set; }
}
