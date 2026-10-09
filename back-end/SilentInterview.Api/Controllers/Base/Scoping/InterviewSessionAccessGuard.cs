using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers.Base.Scoping;

/// <inheritdoc cref="IInterviewSessionAccessGuard"/>
public sealed class InterviewSessionAccessGuard : IInterviewSessionAccessGuard
{
    private readonly SilentInterviewDbContext _context;

    public InterviewSessionAccessGuard(SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<bool> CanAccessAsync(ControllerBase controller, Guid sessionId, Guid userId, CancellationToken cancellationToken = default)
    {
        var user = controller.User;

        if (user.IsInRole("SuperAdmin"))
        {
            return await _context.InterviewSessions
                .AnyAsync(session => session.Id == sessionId && !session.IsDeleted, cancellationToken);
        }

        if (user.IsInRole("Candidate"))
        {
            return await _context.InterviewSessions.AnyAsync(session =>
                session.Id == sessionId && !session.IsDeleted && session.JobApplication.Candidate.UserId == userId, cancellationToken);
        }

        return await _context.InterviewSessions.AnyAsync(session =>
            session.Id == sessionId && !session.IsDeleted && _context.Recruiters.Any(recruiter =>
                recruiter.UserId == userId && recruiter.CompanyId == session.JobApplication.Job.CompanyId),
            cancellationToken);
    }
}
