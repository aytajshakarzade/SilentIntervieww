public class JobDto
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Requirements { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    public Guid CompanyId { get; set; }

    public string CompanyName { get; set; } = string.Empty;

    // Phase 3A — interview configuration
    public string? Experience { get; set; }

    public string? Skills { get; set; }

    public string? Difficulty { get; set; }

    public string? Language { get; set; }

    public int? EstimatedDuration { get; set; }

    public string? Culture { get; set; }
}