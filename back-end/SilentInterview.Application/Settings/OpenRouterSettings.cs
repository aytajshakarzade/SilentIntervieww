namespace SilentInterview.Application.Settings;

/// <summary>
/// Configuration for all AI chat-completion calls.
/// Previously backed by OpenRouter; now backed by Groq (https://api.groq.com/openai/v1/).
/// The section name stays "OpenRouter" in appsettings.json for backward compatibility
/// so no other code needs to change.
/// </summary>
public sealed class OpenRouterSettings
{
    public const string SectionName = "OpenRouter";

    public string BaseUrl { get; init; } = "https://api.groq.com/openai/v1/";

    public string QuestionGenerationModel { get; init; } = string.Empty;

    public string InterviewFlowModel { get; init; } = string.Empty;

    public string ReportModel { get; init; } = string.Empty;

    public int TimeoutSeconds { get; init; } = 45;

    public int MaxRetryAttempts { get; init; } = 3;

    public int RetryBaseDelayMilliseconds { get; init; } = 500;

    // Per-feature token limits
    public int QuestionGenerationMaxTokens { get; init; } = 2000;

    public int AnswerEvaluationMaxTokens { get; init; } = 500;

    public int AssistantMaxTokens { get; init; } = 300;

    public int ReportMaxTokens { get; init; } = 1500;
}
