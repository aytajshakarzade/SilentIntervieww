using SilentInterview.Domain.Common;
using static System.Net.Mime.MediaTypeNames;

namespace SilentInterview.Domain.Entities;

public class Job : AuditableEntity
{
    public Guid CompanyId { get; set; }

    public Company Company { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Requirements { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    // ============================
    // Phase 3A — Interview configuration
    // Stored on the Job so InterviewSessionService can auto-generate the
    // AI interview plan without HR visiting a separate generator page.
    // ============================

    /// <summary>e.g. "Junior", "Mid", "Senior", "Lead".</summary>
    public string? Experience { get; set; }

    /// <summary>Comma/semicolon/newline separated list of required skills.</summary>
    public string? Skills { get; set; }

    /// <summary>e.g. "Easy", "Medium", "Hard".</summary>
    public string? Difficulty { get; set; }

    /// <summary>"az", "en", or "ru". Defaults to "en" when unset.</summary>
    public string? Language { get; set; }

    /// <summary>Target interview duration, in minutes.</summary>
    public int? EstimatedDuration { get; set; }

    /// <summary>Free-text description of the company/team culture.</summary>
    public string? Culture { get; set; }

    public ICollection<JobApplication> Applications { get; set; }
        = new List<JobApplication>();
}