namespace SilentInterview.Application.Common.Interfaces;

/// <summary>
/// Low-level client for the Groq chat completions API (OpenAI-compatible).
/// Endpoint: https://api.groq.com/openai/v1/
/// All higher-level AI services (QuestionGenerationService, InterviewAIService,
/// ReportAIService, AIAssistantService) go through this interface so retry,
/// timeout, logging and error handling live in one place.
/// The model is passed per-call so each higher-level service can be configured
/// independently (see OpenRouterSettings in appsettings.json).
/// </summary>
public interface IOpenRouterService
{
    /// <summary>
    /// Sends a chat completion request and returns the raw assistant message content.
    /// </summary>
    /// <param name="model">Groq model string, e.g. "llama-3.3-70b-versatile".</param>
    /// <param name="systemPrompt">System role instructions.</param>
    /// <param name="userPrompt">User role content.</param>
    /// <param name="maxTokens">Maximum tokens the model may generate in this response.</param>
    /// <param name="temperature">Sampling temperature.</param>
    /// <param name="jsonMode">If true, requests structured JSON output from the model.</param>
    Task<string> CompleteAsync(
        string model,
        string systemPrompt,
        string userPrompt,
        int maxTokens,
        double temperature = 0.7,
        bool jsonMode = false,
        CancellationToken cancellationToken = default);
}
