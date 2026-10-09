using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class User : AuditableEntity
{
    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public Role Role { get; set; }

    public bool EmailConfirmed { get; set; }


    public bool IsActive { get; set; } = true;

    /// <summary>Current commercial plan: Free, Go, or Pro.</summary>
    public string Plan { get; set; } = "Free";

    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public DateTime? SubscriptionCurrentPeriodEnd { get; set; }

    // Enterprise Refresh Tokens
    public ICollection<RefreshToken> RefreshTokens { get; set; }
        = new List<RefreshToken>();

    public ICollection<Notification> Notifications { get; set; }
        = new List<Notification>();
}
