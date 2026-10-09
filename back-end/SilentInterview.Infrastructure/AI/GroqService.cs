using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.Settings;

namespace SilentInterview.Infrastructure.AI;

/// <summary>
/// Groq chat completions client (OpenAI-compatible API).
/// Endpoint: https://api.groq.com/openai/v1/chat/completions
/// Uses Groq's OpenAI-compatible endpoint. If a configured model is unavailable to
/// the current project/key, the client discovers an allowed supported model and retries.
/// Implements IOpenRouterService so all existing AI consumers work unchanged.
/// </summary>
public sealed class GroqService : IOpenRouterService
{
    private readonly HttpClient _httpClient;
    private readonly OpenRouterSettings _settings;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GroqService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    // Keep the fallback list to current Groq chat models that are suitable for
    // JSON mode / structured interview output. The service also queries /models
    // and filters this list against what the current API key/project can access.
    private static readonly string[] ModelFallbacks =
    {
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b"
    };

    public GroqService(
        HttpClient httpClient,
        IOptions<OpenRouterSettings> settings,
        IConfiguration configuration,
        ILogger<GroqService> logger)
    {
        _httpClient = httpClient;
        _settings = settings.Value;
        _configuration = configuration;
        _logger = logger;
    }

    private string GetApiKey()
    {
        // Be deliberately defensive about configuration sources. Docker/.env can
        // expose the same secret under different ASP.NET Core configuration paths.
        // Never log the secret itself.
        var candidates = new[]
        {
            _configuration["GROQ_API_KEY"],
            _configuration["Groq:ApiKey"],
            _configuration["Groq__ApiKey"],
            _configuration["OpenRouter:ApiKey"],
            _configuration["OpenRouter__ApiKey"],
            Environment.GetEnvironmentVariable("GROQ_API_KEY"),
            Environment.GetEnvironmentVariable("Groq__ApiKey"),
            Environment.GetEnvironmentVariable("OpenRouter__ApiKey")
        };

        var key = candidates.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v))?.Trim();

        _logger.LogInformation(
            "GroqService key check: present={Present}, length={Length}, source={Source}",
            !string.IsNullOrWhiteSpace(key),
            key?.Length ?? 0,
            GetKeySource());

        if (string.IsNullOrWhiteSpace(key))
        {
            _logger.LogError(
                "Groq API key is not available from GROQ_API_KEY, Groq:ApiKey, or OpenRouter:ApiKey configuration. " +
                "The application will not call the provider until a key is supplied to the API container.");
            throw new SilentInterview.Application.Common.AINotConfiguredException();
        }

        return key;

        string GetKeySource()
        {
            if (!string.IsNullOrWhiteSpace(_configuration["GROQ_API_KEY"])) return "GROQ_API_KEY";
            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GROQ_API_KEY"))) return "process:GROQ_API_KEY";
            if (!string.IsNullOrWhiteSpace(_configuration["Groq:ApiKey"])) return "Groq:ApiKey";
            if (!string.IsNullOrWhiteSpace(_configuration["Groq__ApiKey"])) return "Groq__ApiKey";
            if (!string.IsNullOrWhiteSpace(_configuration["OpenRouter:ApiKey"])) return "OpenRouter:ApiKey";
            if (!string.IsNullOrWhiteSpace(_configuration["OpenRouter__ApiKey"])) return "OpenRouter__ApiKey";
            return "none";
        }
    }

    public async Task<string> CompleteAsync(
        string model,
        string systemPrompt,
        string userPrompt,
        int maxTokens,
        double temperature = 0.7,
        bool jsonMode = false,
        CancellationToken cancellationToken = default)
    {
        var apiKey = GetApiKey();

        if (string.IsNullOrWhiteSpace(model))
            throw new InvalidOperationException("No AI model configured.");

        var baseUrl = ResolveBaseUrl(apiKey);
        var candidateModels = await ResolveModelsAsync(model, apiKey, baseUrl, cancellationToken);
        Exception? lastError = null;

        foreach (var candidateModel in candidateModels)
        {
            try
            {
                var result = await SendCompletionAsync(
                    candidateModel, systemPrompt, userPrompt, maxTokens, temperature, jsonMode, apiKey, baseUrl, cancellationToken);
                return result;
            }
            catch (GroqModelUnavailableException ex)
            {
                lastError = ex;
                _logger.LogWarning("Groq model unavailable: {Model}. Trying next allowed model.", candidateModel);
            }
        }

        throw new GroqException(
            $"Groq could not access any configured AI model. Last error: {lastError?.Message ?? "unknown error"}", lastError);
    }

    private string ResolveBaseUrl(string apiKey)
    {
        // Keep the user's existing .env untouched. Older SilentInterview setups
        // may have an OpenRouter key stored under GROQ_API_KEY. Detect the
        // credential family and route it to the matching OpenAI-compatible API.
        if (apiKey.StartsWith("sk-or-", StringComparison.OrdinalIgnoreCase))
            return "https://openrouter.ai/api/v1/";

        return (_settings.BaseUrl ?? "https://api.groq.com/openai/v1/").TrimEnd('/') + "/";
    }

    private async Task<List<string>> ResolveModelsAsync(string configuredModel, string apiKey, string baseUrl, CancellationToken ct)
    {
        var ordered = new List<string>();
        void Add(string? m) { if (!string.IsNullOrWhiteSpace(m) && !ordered.Contains(m)) ordered.Add(m); }

        Add(configuredModel);
        foreach (var fallback in ModelFallbacks) Add(fallback);

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get, new Uri(new Uri(baseUrl), "models"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            using var response = await _httpClient.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(json);
                var available = doc.RootElement.TryGetProperty("data", out var data)
                    ? data.EnumerateArray()
                        .Select(x => x.TryGetProperty("id", out var id) ? id.GetString() : null)
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Select(x => x!)
                        .ToHashSet(StringComparer.OrdinalIgnoreCase)
                    : new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                if (available.Count > 0)
                {
                    var allowed = ordered.Where(m => available.Contains(m)).ToList();
                    if (allowed.Count > 0) return allowed;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not query Groq /models; using configured fallback order.");
        }

        return ordered;
    }

    private async Task<string> SendCompletionAsync(
        string model,
        string systemPrompt,
        string userPrompt,
        int maxTokens,
        double temperature,
        bool jsonMode,
        string apiKey,
        string baseUrl,
        CancellationToken cancellationToken)
    {
        var messages = new object[]
        {
            new { role = "system", content = systemPrompt },
            new { role = "user", content = userPrompt }
        };

        var body = new Dictionary<string, object?>
        {
            ["model"] = model,
            ["messages"] = messages,
            ["temperature"] = temperature,
            ["max_tokens"] = Math.Max(50, maxTokens)
        };

        if (jsonMode)
            body["response_format"] = new { type = "json_object" };

        var json = JsonSerializer.Serialize(body, JsonOptions);
        var maxAttempts = Math.Max(1, _settings.MaxRetryAttempts);

        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                using var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    new Uri(new Uri(baseUrl), "chat/completions"))
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                if (baseUrl.Contains("openrouter.ai", StringComparison.OrdinalIgnoreCase))
                {
                    request.Headers.TryAddWithoutValidation("X-Title", "SilentInterview");
                }

                using var response = await _httpClient.SendAsync(request, cancellationToken);
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var unavailable = response.StatusCode == HttpStatusCode.NotFound &&
                        responseBody.Contains("model_not_found", StringComparison.OrdinalIgnoreCase);
                    var shouldRetry = IsTransient(response.StatusCode) && attempt < maxAttempts;

                    _logger.LogWarning(
                        "Groq FAILED: model={Model}, attempt={Attempt}/{Max}, HTTP={StatusCode}, retry={Retry}, BODY={Body}",
                        model, attempt, maxAttempts, (int)response.StatusCode, shouldRetry, Truncate(responseBody, 1000));

                    if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                        throw new GroqAuthenticationException("Groq authentication failed. The configured AI credential was rejected by the provider.");

                    if (unavailable)
                        throw new GroqModelUnavailableException(
                            $"Groq HTTP 404 for model {model}: {Truncate(responseBody, 500)}");

                    if (shouldRetry)
                    {
                        await DelayBeforeRetry(attempt, cancellationToken);
                        continue;
                    }

                    throw new GroqException(
                        $"Groq HTTP {(int)response.StatusCode}: {Truncate(responseBody, 500)}");
                }

                using var doc = JsonDocument.Parse(responseBody);
                var choices = doc.RootElement.GetProperty("choices");
                if (choices.GetArrayLength() == 0)
                    throw new GroqException("Groq returned empty choices.");

                var content = choices[0].GetProperty("message").GetProperty("content").GetString();
                if (string.IsNullOrWhiteSpace(content))
                    throw new GroqException("Groq returned empty content.");

                _logger.LogInformation("Groq OK: model={Model}, chars={Len}", model, content.Length);
                return content.Trim();
            }
            catch (Exception ex) when (ex is TaskCanceledException or HttpRequestException)
            {
                if (attempt >= maxAttempts)
                    throw new GroqException($"Groq network failure after {maxAttempts} attempts for model={model}.", ex);
                await DelayBeforeRetry(attempt, cancellationToken);
            }
        }

        throw new GroqException($"Groq failed for model={model}.");
    }

    private async Task DelayBeforeRetry(int attempt, CancellationToken ct)
    {
        var ms = _settings.RetryBaseDelayMilliseconds * Math.Pow(2, attempt - 1);
        await Task.Delay(TimeSpan.FromMilliseconds(ms), ct);
    }

    private static bool IsTransient(HttpStatusCode s) =>
        s == HttpStatusCode.TooManyRequests ||
        s == HttpStatusCode.RequestTimeout ||
        (int)s >= 500;

    private static string Truncate(string v, int max = 500) =>
        v.Length <= max ? v : v[..max] + "…";
}

public class GroqException : Exception
{
    public GroqException(string message) : base(message) { }
    public GroqException(string message, Exception? inner) : base(message, inner) { }
}

public sealed class GroqModelUnavailableException : GroqException
{
    public GroqModelUnavailableException(string message) : base(message) { }
}

public sealed class GroqAuthenticationException : GroqException
{
    public GroqAuthenticationException(string message) : base(message) { }
}
