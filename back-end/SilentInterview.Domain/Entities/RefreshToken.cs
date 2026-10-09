using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class RefreshToken : AuditableEntity
{
    public string Token { get; set; } = string.Empty;

    public DateTime Expires { get; set; }

    public bool IsRevoked { get; set; }

    public Guid UserId { get; set; }

    public User User { get; set; } = null!;

    public bool IsExpired => DateTime.UtcNow >= Expires;

    public bool IsActive => !IsRevoked && !IsExpired;
}