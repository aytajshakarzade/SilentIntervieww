using SilentInterview.Application.DTOs.Notification;

namespace SilentInterview.Application.Interfaces;

public interface INotificationService
{
    Task<NotificationFeedDto> GetForUserAsync(Guid userId, int take, CancellationToken cancellationToken = default);
    Task<bool> MarkReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default);
    Task MarkAllReadAsync(Guid userId, CancellationToken cancellationToken = default);
    Task CreateAsync(Guid userId, string type, string title, string message, string? link = null, CancellationToken cancellationToken = default);
}
