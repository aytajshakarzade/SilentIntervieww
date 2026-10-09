using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Application.Interfaces;

namespace SilentInterview.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class NotificationController(INotificationService notificationService) : BaseApiController
{
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 12, CancellationToken cancellationToken = default)
    {
        if (!TryGetUserId(out var userId)) return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        return Success(await notificationService.GetForUserAsync(userId, take, cancellationToken), "Notifications retrieved successfully.");
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        if (!await notificationService.MarkReadAsync(id, userId, cancellationToken))
            return Failure("Notification not found.", StatusCodes.Status404NotFound);
        return Success(true, "Notification marked as read.");
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId)) return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        await notificationService.MarkAllReadAsync(userId, cancellationToken);
        return Success(true, "All notifications marked as read.");
    }

    private bool TryGetUserId(out Guid userId) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out userId);
}
