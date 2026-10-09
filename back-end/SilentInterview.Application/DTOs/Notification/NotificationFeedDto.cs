namespace SilentInterview.Application.DTOs.Notification;

public sealed class NotificationFeedDto
{
    public IReadOnlyList<NotificationDto> Items { get; init; } = [];
    public int UnreadCount { get; init; }
}
