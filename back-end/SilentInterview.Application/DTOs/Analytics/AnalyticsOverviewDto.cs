namespace SilentInterview.Application.DTOs.Analytics;

public sealed class AnalyticsOverviewDto
{
    public int TotalJobs { get; init; }
    public int ActiveJobs { get; init; }
    public int ArchivedJobs { get; init; }
    public int TotalCandidates { get; init; }
    public int TotalApplications { get; init; }
    public int CompletedInterviews { get; init; }
    public int ShortlistedApplications { get; init; }
    public int AcceptedApplications { get; init; }
    public int RejectedApplications { get; init; }
    public decimal? AverageInterviewScore { get; init; }
    public decimal? SuccessRate { get; init; }
    public IReadOnlyList<AnalyticsSeriesPointDto> ApplicationsOverTime { get; init; } = [];
    public IReadOnlyList<AnalyticsSeriesPointDto> HiringFunnel { get; init; } = [];
    public IReadOnlyList<AnalyticsSeriesPointDto> ApplicationStatuses { get; init; } = [];
    public IReadOnlyList<JobPerformanceDto> TopJobs { get; init; } = [];
}

public sealed class AnalyticsSeriesPointDto
{
    public string Label { get; init; } = string.Empty;
    public int Value { get; init; }
}

public sealed class JobPerformanceDto
{
    public Guid JobId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public int Applications { get; init; }
    public int CompletedInterviews { get; init; }
    public decimal? AverageScore { get; init; }
}
