using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

public class SubscriptionEvent : BaseEntity
{
    public string StripeEventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public Guid? UserId { get; set; }
    public string? Payload { get; set; }
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
