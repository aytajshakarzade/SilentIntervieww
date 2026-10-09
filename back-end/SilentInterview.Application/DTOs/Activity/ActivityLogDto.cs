namespace SilentInterview.Application.DTOs.Activity;

public sealed class ActivityLogDto
{
    public Guid Id { get; init; }
    public string Action { get; init; } = string.Empty;
    public string EntityType { get; init; } = string.Empty;
    public Guid? EntityId { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? ActorName { get; init; }
    public DateTime CreatedAt { get; init; }
}
