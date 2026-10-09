using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class Candidate : AuditableEntity
{
    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public string ResumeUrl { get; set; } = string.Empty;

    public string Skills { get; set; } = string.Empty;

    public string Education { get; set; } = string.Empty;

    public string Experience { get; set; } = string.Empty;
}