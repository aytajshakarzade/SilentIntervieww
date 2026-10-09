namespace SilentInterview.Application.Interfaces;

/// <summary>
/// Real grammar analysis backed by the LanguageTool public API
/// (https://languagetool.org/http-api/). No heuristic fallback is used
/// when computing GrammarScore — if the API is unreachable for a given
/// answer, the result is null (excluded from aggregates) rather than
/// approximated.
/// </summary>
public interface IGrammarCheckService
{
    /// <summary>
    /// Checks the given text against LanguageTool and returns a 0-100
    /// grammar score plus the raw issue count. Returns null if the
    /// service could not be reached or the text was empty.
    /// </summary>
    Task<GrammarCheckResult?> CheckAsync(string text, CancellationToken cancellationToken = default);
}

/// <summary>
/// score: 100 - (weighted error density), clamped 0-100.
/// Formula (documented, deterministic): every LanguageTool match reduces
/// the score by (issue weight / word count) * 100, where grammar/spelling
/// categories weigh 3x and style/typography categories weigh 1x. This
/// makes the score comparable across answers of different lengths instead
/// of simply penalizing longer answers for having more raw matches.
/// </summary>
public sealed record GrammarCheckResult(int Score, int IssueCount);
