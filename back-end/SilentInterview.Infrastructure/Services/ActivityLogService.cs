using Microsoft.EntityFrameworkCore;
using SilentInterview.Application.DTOs.Activity;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public sealed class ActivityLogService(SilentInterviewDbContext context) : IActivityLogService
{
    public async Task<IReadOnlyList<ActivityLogDto>> GetRecentForCompanyAsync(Guid? companyId, int take, CancellationToken cancellationToken = default)
    {
        var pageSize = Math.Clamp(take, 1, 100);
        var query = context.ActivityLogs.AsNoTracking().Include(log => log.ActorUser).AsQueryable();
        if (companyId.HasValue)
            query = query.Where(log => log.CompanyId == companyId.Value);

        return await query
            .OrderByDescending(log => log.CreatedAt)
            .Take(pageSize)
            .Select(log => new ActivityLogDto
            {
                Id = log.Id,
                Action = log.Action,
                EntityType = log.EntityType,
                EntityId = log.EntityId,
                Description = log.Description,
                ActorName = log.ActorUser == null ? null : log.ActorUser.FullName,
                CreatedAt = log.CreatedAt
            })
            .ToListAsync(cancellationToken);
    }

    public async Task RecordApplicationEventAsync(Guid applicationId, Guid? actorUserId, string action, string description, CancellationToken cancellationToken = default)
    {
        var companyId = await context.JobApplications
            .Where(application => application.Id == applicationId)
            .Select(application => (Guid?)application.Job.CompanyId)
            .SingleOrDefaultAsync(cancellationToken);
        if (!companyId.HasValue) return;

        context.ActivityLogs.Add(new ActivityLog
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            ActorUserId = actorUserId,
            Action = action,
            EntityType = "JobApplication",
            EntityId = applicationId,
            Description = description,
            CreatedAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync(cancellationToken);
    }
}
