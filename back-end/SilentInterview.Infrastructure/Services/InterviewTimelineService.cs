using Microsoft.EntityFrameworkCore;
using SilentInterview.Application.DTOs.InterviewEvent;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public sealed class InterviewTimelineService(SilentInterviewDbContext context) : IInterviewTimelineService
{
    public async Task<IReadOnlyList<InterviewEventDto>> GetAsync(Guid interviewSessionId, CancellationToken cancellationToken = default) =>
        await context.InterviewEvents
            .AsNoTracking()
            .Where(item => item.InterviewSessionId == interviewSessionId)
            .OrderBy(item => item.OccurredAt)
            .Select(item => new InterviewEventDto
            {
                Id = item.Id,
                InterviewSessionId = item.InterviewSessionId,
                Type = item.Type,
                Detail = item.Detail,
                OccurredAt = item.OccurredAt
            })
            .ToListAsync(cancellationToken);

    public async Task RecordAsync(Guid interviewSessionId, Guid? actorUserId, string type, string detail, CancellationToken cancellationToken = default)
    {
        context.InterviewEvents.Add(new InterviewEvent
        {
            Id = Guid.NewGuid(),
            InterviewSessionId = interviewSessionId,
            ActorUserId = actorUserId,
            Type = type,
            Detail = detail,
            OccurredAt = DateTime.UtcNow
        });
        await context.SaveChangesAsync(cancellationToken);
    }
}
