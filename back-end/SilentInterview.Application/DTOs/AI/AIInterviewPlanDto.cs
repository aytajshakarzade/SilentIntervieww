namespace SilentInterview.Application.DTOs.AI;

public sealed class GenerateInterviewPlanRequest
{
    public Guid InterviewSessionId { get; set; }

    /// <summary>Explicit job title override. Falls back to the linked Job's title when omitted.</summary>
    public string? JobTitle { get; set; }

    /// <summary>Explicit job description override. Falls back to the linked Job's description when omitted.</summary>
    public string? JobDescription { get; set; }

    public List<string>? RequiredSkills { get; set; }

    /// <summary>e.g. "Junior", "Mid", "Senior", "Lead".</summary>
    public string? ExperienceLevel { get; set; }

    public string? CompanyCulture { get; set; }

    /// <summary>e.g. "Junior", "Mid", "Senior", "Staff", "Principal".</summary>
    public string? SeniorityLevel { get; set; }

    public int? InterviewDurationMinutes { get; set; }

    /// <summary>"az", "en", or "ru". Defaults to "en".</summary>
    public string? Language { get; set; }
}

public sealed class AIInterviewPlanDto
{
    public Guid Id { get; set; }

    public Guid InterviewSessionId { get; set; }

    public string InterviewTitle { get; set; } = string.Empty;

    /// <summary>AI-generated opening introduction read/shown to the candidate before Q&amp;A begins.</summary>
    public string? Introduction { get; set; }

    public string Difficulty { get; set; } = string.Empty;

    public int EstimatedDurationMinutes { get; set; }

    public string Language { get; set; } = "en";

    public List<AIInterviewSectionDto> Sections { get; set; } = new();

    public DateTime CreatedAt { get; set; }
}

public sealed class AIInterviewSectionDto
{
    /// <summary>"technical" | "behavioral" | "situational" | "soft_skill" | "culture_fit" | "problem_solving".</summary>
    public string Type { get; set; } = string.Empty;

    public List<AIInterviewQuestionDto> Questions { get; set; } = new();
}

public sealed class AIInterviewQuestionDto
{
    public string Id { get; set; } = string.Empty;

    public int Order { get; set; }

    public string Text { get; set; } = string.Empty;

    /// <summary>"easy" | "medium" | "hard" — difficulty progression within the section.</summary>
    public string? DifficultyLevel { get; set; }

    /// <summary>What a strong answer to this question would cover, for the interviewer/recruiter's reference.</summary>
    public string? ExpectedAnswer { get; set; }

    /// <summary>Bullet-style criteria the recruiter should score the candidate's answer against.</summary>
    public List<string> EvaluationCriteria { get; set; } = new();
}
