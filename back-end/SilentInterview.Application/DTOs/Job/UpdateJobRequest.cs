namespace SilentInterview.Application.DTOs.Job;

public class UpdateJobRequest
{
    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Requirements { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    public Guid CompanyId { get; set; }

    // Phase 3A — interview configuration
    public string? Experience { get; set; }

    public string? Skills { get; set; }

    public string? Difficulty { get; set; }

    public string? Language { get; set; }

    public int? EstimatedDuration { get; set; }

    public string? Culture { get; set; }
}