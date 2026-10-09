namespace SilentInterview.Application.DTOs.AI;

public sealed class EvaluateAnswerRequest
{
    public Guid InterviewSessionId { get; set; }

    public Guid InterviewAnswerId { get; set; }
}

public sealed class AnswerEvaluationDto
{
    public Guid Id { get; set; }

    public Guid InterviewAnswerId { get; set; }

    public int TechnicalAccuracy { get; set; }

    public int CommunicationScore { get; set; }

    public int ConfidenceScore { get; set; }

    public int ClarityScore { get; set; }

    public int DepthScore { get; set; }

    public List<string> KeywordsDetected { get; set; } = new();

    public List<string> Strengths { get; set; } = new();

    public List<string> Weaknesses { get; set; } = new();

    public bool FollowUpNeeded { get; set; }

    public string AiComment { get; set; } = string.Empty;

    /// <summary>"continue_deeper" | "clarify" | "move_next".</summary>
    public string NextAction { get; set; } = "move_next";

    public string? FollowUpQuestion { get; set; }
}

public sealed class NextQuestionRequest
{
    public Guid InterviewSessionId { get; set; }
}

public sealed class NextQuestionDto
{
    /// <summary>Null when the interview has covered all planned questions and should end.</summary>
    public string? QuestionId { get; set; }

    public string? QuestionText { get; set; }

    public string? SectionType { get; set; }

    public bool IsFollowUp { get; set; }

    public bool InterviewComplete { get; set; }

    public int AnsweredCount { get; set; }

    public int TotalPlannedCount { get; set; }
}
