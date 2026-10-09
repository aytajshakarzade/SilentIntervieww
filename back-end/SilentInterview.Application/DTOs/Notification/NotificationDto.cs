namespace SilentInterview.Application.DTOs.Notification;

public sealed class NotificationDto
{
    public Guid Id { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Title { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public string? Link { get; init; }
    public bool IsRead { get; init; }
    public DateTime CreatedAt { get; init; }
}
