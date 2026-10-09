namespace SilentInterview.Application.Settings;

/// <summary>
/// Deployment-level policy for the deterministic interview report engine.
/// </summary>
public sealed class InterviewReportSettings
{
    public const string SectionName = "InterviewReporting";

    public int MinimumAnswerWords { get; init; } = 20;
    public int TargetAverageAnswerWords { get; init; } = 80;
    public int ExcellentAverageAnswerWords { get; init; } = 150;
    public decimal MaximumFillerWordRatioPercent { get; init; } = 3m;
    public int MinimumRecommendedWordsPerMinute { get; init; } = 110;
    public int MaximumRecommendedWordsPerMinute { get; init; } = 170;

    /// <summary>
    /// Domain/technical keywords used to compute domain keyword density for
    /// the Technical score. Configurable per deployment (e.g. per job family).
    /// Kept intentionally broad/software-leaning as a sane default; override
    /// via appsettings for non-technical interview tracks.
    /// </summary>
    public string[] TechnicalKeywords { get; init; } = new[]
    {
        "algorithm", "architecture", "api", "database", "framework", "system design",
        "scalab", "performance", "optimi", "test", "deploy", "pipeline", "cloud",
        "microservice", "security", "debug", "refactor", "integration", "protocol",
        "data structure", "cache", "latency", "throughput", "infrastructure", "model",
        "query", "schema", "container", "version control", "code review", "automation"
    };

    /// <summary>Decisive/ownership/action-oriented words used in the Leadership score's "decisive language" and "ownership" components.</summary>
    public string[] LeadershipKeywords { get; init; } = new[]
    {
        "i decided", "i led", "i owned", "i took ownership", "i initiated", "i drove",
        "my responsibility", "i took charge", "i delegated", "i mentored", "i coached",
        "i motivated", "i organized the team", "i set the direction", "i made the call"
    };

    /// <summary>Teamwork/collaboration/empathy vocabulary used in the Culture Fit score.</summary>
    public string[] CultureFitKeywords { get; init; } = new[]
    {
        "we", "our team", "collaborat", "together", "teamwork", "helped my", "supported",
        "listened", "feedback", "empath", "appreciate", "grateful", "respect", "inclusive",
        "diverse", "mentor", "encourage", "please", "thank you", "partner with"
    };
}
