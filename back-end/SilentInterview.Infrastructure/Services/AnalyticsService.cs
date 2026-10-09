using Microsoft.EntityFrameworkCore;
using SilentInterview.Application.DTOs.Analytics;
using SilentInterview.Application.Interfaces;
using SilentInterview.Domain.Entities;
using SilentInterview.Domain.Enums;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Services;

public sealed class AnalyticsService(SilentInterviewDbContext context) : IAnalyticsService
{
    public async Task<AnalyticsOverviewDto> GetOverviewAsync(Guid requesterId, string role, string? period, CancellationToken cancellationToken = default)
    {
        var companyId = await GetCompanyScopeAsync(requesterId, role, cancellationToken);

        // IgnoreQueryFilters: this method deliberately reports both active
        // and archived (soft-deleted) jobs (activeJobs/archivedJobs below),
        // so the global !IsDeleted filter must be bypassed here.
        IQueryable<Job> scopedJobs = context.Jobs.AsNoTracking().IgnoreQueryFilters();
        if (companyId.HasValue)
            scopedJobs = scopedJobs.Where(job => job.CompanyId == companyId.Value);

        var totalJobs = await scopedJobs.CountAsync(cancellationToken);
        var activeJobs = await scopedJobs.CountAsync(job => !job.IsDeleted, cancellationToken);
        var archivedJobs = await scopedJobs.CountAsync(job => job.IsDeleted, cancellationToken);
        var jobIds = scopedJobs.Where(job => !job.IsDeleted).Select(job => job.Id);

        var applications = context.JobApplications
            .AsNoTracking()
            .Where(application => jobIds.Contains(application.JobId));

        var applicationRows = await applications
            .Select(application => new { application.Id, application.JobId, application.Status, application.AppliedAt })
            .ToListAsync(cancellationToken);

        var applicationIds = applicationRows.Select(application => application.Id).ToList();
        var sessions = await context.InterviewSessions
            .AsNoTracking()
            .Where(session => applicationIds.Contains(session.JobApplicationId))
            .Select(session => new { session.Id, session.JobApplicationId, session.EndedAt })
            .ToListAsync(cancellationToken);

        var sessionIds = sessions.Select(session => session.Id).ToList();
        var reports = await context.Reports
            .AsNoTracking()
            .Where(report => sessionIds.Contains(report.InterviewSessionId))
            .Select(report => new { report.InterviewSessionId, report.Score })
            .ToListAsync(cancellationToken);

        var totalCandidates = await applications.Select(application => application.CandidateId).Distinct().CountAsync(cancellationToken);
        var accepted = applicationRows.Count(application => application.Status is ApplicationStatus.Accepted or ApplicationStatus.Hired);
        var rejected = applicationRows.Count(application => application.Status == ApplicationStatus.Rejected);
        var shortlisted = applicationRows.Count(application => application.Status is ApplicationStatus.Shortlisted or ApplicationStatus.ReviewPending);
        var completed = sessions.Count(session => session.EndedAt.HasValue);
        var reportScores = reports.Select(report => report.Score).ToList();

        var jobs = await scopedJobs
            .Where(job => !job.IsDeleted)
            .Select(job => new { job.Id, job.Title })
            .ToListAsync(cancellationToken);

        var reportByApplication = reports
            .Join(sessions, report => report.InterviewSessionId, session => session.Id,
                (report, session) => new { session.JobApplicationId, report.Score })
            .GroupBy(item => item.JobApplicationId)
            .ToDictionary(group => group.Key, group => group.Select(item => item.Score).ToList());

        var topJobs = jobs
            .Select(job =>
            {
                var jobApplications = applicationRows.Where(application => application.JobId == job.Id).ToList();
                var scores = jobApplications.SelectMany(application => reportByApplication.GetValueOrDefault(application.Id) ?? []).ToList();
                return new JobPerformanceDto
                {
                    JobId = job.Id,
                    JobTitle = job.Title,
                    Applications = jobApplications.Count,
                    CompletedInterviews = sessions.Count(session => jobApplications.Any(application => application.Id == session.JobApplicationId) && session.EndedAt.HasValue),
                    AverageScore = scores.Count == 0 ? null : Math.Round((decimal)scores.Average(), 1)
                };
            })
            .OrderByDescending(job => job.Applications)
            .ThenBy(job => job.JobTitle)
            .Take(5)
            .ToList();

        return new AnalyticsOverviewDto
        {
            TotalJobs = totalJobs,
            ActiveJobs = activeJobs,
            ArchivedJobs = archivedJobs,
            TotalCandidates = totalCandidates,
            TotalApplications = applicationRows.Count,
            CompletedInterviews = completed,
            ShortlistedApplications = shortlisted,
            AcceptedApplications = accepted,
            RejectedApplications = rejected,
            AverageInterviewScore = reportScores.Count == 0 ? null : Math.Round((decimal)reportScores.Average(), 1),
            SuccessRate = applicationRows.Count == 0 ? null : Math.Round((decimal)accepted * 100 / applicationRows.Count, 1),
            ApplicationsOverTime = BuildApplicationSeries(applicationRows.Select(application => application.AppliedAt), period),
            HiringFunnel =
            [
                new() { Label = "Applied", Value = applicationRows.Count },
                new() { Label = "Interviewed", Value = completed },
                new() { Label = "Shortlisted", Value = shortlisted },
                new() { Label = "Accepted", Value = accepted }
            ],
            ApplicationStatuses = applicationRows
                .GroupBy(application => application.Status.ToString())
                .OrderBy(group => group.Key)
                .Select(group => new AnalyticsSeriesPointDto { Label = group.Key, Value = group.Count() })
                .ToList(),
            TopJobs = topJobs
        };
    }

    private async Task<Guid?> GetCompanyScopeAsync(Guid requesterId, string role, CancellationToken cancellationToken)
    {
        if (string.Equals(role, "ADMIN", StringComparison.OrdinalIgnoreCase))
            return null;

        return await context.Recruiters
            .AsNoTracking()
            .Where(recruiter => recruiter.UserId == requesterId)
            .Select(recruiter => (Guid?)recruiter.CompanyId)
            .SingleOrDefaultAsync(cancellationToken);
    }

    private static IReadOnlyList<AnalyticsSeriesPointDto> BuildApplicationSeries(IEnumerable<DateTime> dates, string? period)
    {
        var normalized = (period ?? "monthly").Trim().ToLowerInvariant();
        var dateList = dates.ToList();
        var now = DateTime.UtcNow;
        var buckets = normalized switch
        {
            "daily" => Enumerable.Range(0, 14).Select(offset => now.Date.AddDays(offset - 13)),
            "weekly" => Enumerable.Range(0, 12).Select(offset => StartOfWeek(now).AddDays((offset - 11) * 7)),
            "yearly" => Enumerable.Range(0, 5).Select(offset => new DateTime(now.Year - 4 + offset, 1, 1)),
            _ => Enumerable.Range(0, 12).Select(offset => new DateTime(now.Year, now.Month, 1).AddMonths(offset - 11))
        };

        return buckets.Select(bucket => new AnalyticsSeriesPointDto
        {
            Label = normalized switch
            {
                "daily" => bucket.ToString("MMM d"),
                "weekly" => bucket.ToString("MMM d"),
                "yearly" => bucket.ToString("yyyy"),
                _ => bucket.ToString("MMM")
            },
            Value = dateList.Count(date => IsInBucket(date, bucket, normalized))
        }).ToList();
    }

    private static DateTime StartOfWeek(DateTime value)
    {
        var offset = ((int)value.DayOfWeek + 6) % 7;
        return value.Date.AddDays(-offset);
    }

    private static bool IsInBucket(DateTime date, DateTime bucket, string period) => period switch
    {
        "daily" => date.Date == bucket.Date,
        "weekly" => StartOfWeek(date) == bucket,
        "yearly" => date.Year == bucket.Year,
        _ => date.Year == bucket.Year && date.Month == bucket.Month
    };
}
