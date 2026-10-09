using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class Recruiter : AuditableEntity
{
    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public Guid CompanyId { get; set; }

    public Company Company { get; set; } = null!;
}