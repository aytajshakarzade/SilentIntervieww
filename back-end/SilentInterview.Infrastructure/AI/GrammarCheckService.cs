using System.Net.Http.Headers;
using System.Text.Json;

using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

using SilentInterview.Application.Interfaces;

namespace SilentInterview.Infrastructure.AI;

/// <summary>
/// Real grammar analysis via the public LanguageTool HTTP API
/// (https://languagetool.org/http-api/, no API key required for the
/// public, rate-limited endpoint at api.languagetool.org).
///
/// GrammarScore formula (deterministic, documented):
///   score = 100 - min(100, sum(issueWeight_i) / wordCount * 100)
/// where each LanguageTool match contributes:
///   - weight 3 if its rule category is grammar or spelling ("GRAMMAR",
///     "TYPOS", "CASING", "CONFUSED_WORDS", "COMPOUNDING")
///   - weight 1 for any other category (style, typography, redundancy, etc.)
/// This normalizes for answer length (a 200-word answer with 2 typos should
/// not score the same as a 20-word answer with 2 typos) and weighs true
/// grammar/spelling errors more heavily than stylistic suggestions.
/// If the API call fails or the text is empty, returns null — the caller
/// excludes the answer from grammar aggregates rather than guessing.
/// </summary>
public sealed class GrammarCheckService : IGrammarCheckService
{
    private static readonly HashSet<string> HeavyCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "GRAMMAR", "TYPOS", "CASING", "CONFUSED_WORDS", "COMPOUNDING", "MISC"
    };

    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<GrammarCheckService> _logger;

    public GrammarCheckService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<GrammarCheckService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        var baseUrl = _configuration["LanguageTool:BaseUrl"] ?? "https://api.languagetool.org/v2/";
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(15);
        _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<GrammarCheckResult?> CheckAsync(string text, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var wordCount = text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        if (wordCount == 0)
            return null;

        try
        {
            var language = _configuration["LanguageTool:Language"] ?? "en-US";
            var form = new Dictionary<string, string>
            {
                ["text"] = text,
                ["language"] = language,
                ["enabledOnly"] = "false"
            };

            using var content = new FormUrlEncodedContent(form);
            using var response = await _httpClient.PostAsync("check", content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning(
                    "LanguageTool returned {StatusCode} for a grammar check request; skipping grammar score for this answer.",
                    response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var document = JsonDocument.Parse(json);

            if (!document.RootElement.TryGetProperty("matches", out var matches))
                return new GrammarCheckResult(100, 0);

            var issueCount = 0;
            decimal weightedSum = 0m;

            foreach (var match in matches.EnumerateArray())
            {
                issueCount++;

                var category = "OTHER";
                if (match.TryGetProperty("rule", out var rule) &&
                    rule.TryGetProperty("category", out var cat) &&
                    cat.TryGetProperty("id", out var catId))
                {
                    category = catId.GetString() ?? "OTHER";
                }

                weightedSum += HeavyCategories.Contains(category) ? 3m : 1m;
            }

            var penalty = Math.Min(100m, weightedSum / wordCount * 100m);
            var score = (int)Math.Round(Math.Clamp(100m - penalty, 0m, 100m));

            return new GrammarCheckResult(score, issueCount);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "LanguageTool grammar check failed; skipping grammar score for this answer.");
            return null;
        }
    }
}
