using Microsoft.EntityFrameworkCore;
using SilentInterview.Application.DTOs.Notification;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public sealed class NotificationService(SilentInterviewDbContext context) : INotificationService
{
    public async Task<NotificationFeedDto> GetForUserAsync(Guid userId, int take, CancellationToken cancellationToken = default)
    {
        var pageSize = Math.Clamp(take, 1, 50);
        var items = await context.Notifications
            .AsNoTracking()
            .Where(notification => notification.UserId == userId)
            .OrderByDescending(notification => notification.CreatedAt)
            .Take(pageSize)
            .Select(notification => new NotificationDto
            {
                Id = notification.Id,
                Type = notification.Type,
                Title = notification.Title,
                Message = notification.Message,
                Link = notification.Link,
                IsRead = notification.IsRead,
                CreatedAt = notification.CreatedAt
            })
            .ToListAsync(cancellationToken);

        var unreadCount = await context.Notifications
            .CountAsync(notification => notification.UserId == userId && !notification.IsRead, cancellationToken);

        return new NotificationFeedDto { Items = items, UnreadCount = unreadCount };
    }

    public async Task<bool> MarkReadAsync(Guid notificationId, Guid userId, CancellationToken cancellationToken = default)
    {
        var notification = await context.Notifications
            .FirstOrDefaultAsync(item => item.Id == notificationId && item.UserId == userId, cancellationToken);
        if (notification is null) return false;

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await context.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    public async Task MarkAllReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        await context.Notifications
            .Where(notification => notification.UserId == userId && !notification.IsRead)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(notification => notification.IsRead, true)
                .SetProperty(notification => notification.ReadAt, DateTime.UtcNow), cancellationToken);
    }

    public async Task CreateAsync(Guid userId, string type, string title, string message, string? link = null, CancellationToken cancellationToken = default)
    {
        context.Notifications.Add(new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Title = title,
            Message = message,
            Link = link,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync(cancellationToken);
    }
}
