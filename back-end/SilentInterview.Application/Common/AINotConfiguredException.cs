namespace SilentInterview.Application.Common;

/// <summary>
/// Thrown when the OpenRouter API key is missing or empty.
/// Controllers catch this and return a clean, localized user-facing error.
/// The raw implementation detail (key name) is never exposed to the frontend.
/// </summary>
public sealed class AINotConfiguredException : Exception
{
    public AINotConfiguredException()
        : base("The AI service is not configured. An API key is required.") { }
}
