using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.AI;
using SilentInterview.Application.DTOs.InterviewSession;
using SilentInterview.Application.Interfaces;

using SilentInterview.Domain.Entities;
using SilentInterview.Domain.Enums;

using SilentInterview.Infrastructure.Persistence;
using SilentInterview.Infrastructure.AI.Prompts;

namespace SilentInterview.Infrastructure.Services;

public class InterviewSessionService : IInterviewSessionService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IQuestionGenerationService _questionGenerationService;
    private readonly ILogger<InterviewSessionService> _logger;

    public InterviewSessionService(
        SilentInterviewDbContext context,
        IQuestionGenerationService questionGenerationService,
        ILogger<InterviewSessionService> logger)
    {
        _context = context;
        _questionGenerationService = questionGenerationService;
        _logger = logger;
    }

    public async Task<PagedResult<InterviewSessionDto>> GetAllAsync(
        InterviewSessionQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        IQueryable<InterviewSession> query =
            _context.InterviewSessions.AsNoTracking();

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        // Search
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim().ToLower();

            if (Guid.TryParse(search, out var guid))
            {
                query = query.Where(x =>
                    x.JobApplicationId == guid);
            }
        }

        // Job Application Filter
        if (parameters.JobApplicationId.HasValue)
        {
            query = query.Where(x =>
                x.JobApplicationId == parameters.JobApplicationId.Value);
        }

        // Date Filters
        if (parameters.StartedAfter.HasValue)
        {
            query = query.Where(x =>
                x.StartedAt >= parameters.StartedAfter.Value);
        }

        if (parameters.StartedBefore.HasValue)
        {
            query = query.Where(x =>
                x.StartedAt <= parameters.StartedBefore.Value);
        }

        // Completed Filter
        if (parameters.IsCompleted.HasValue)
        {
            query = parameters.IsCompleted.Value
                ? query.Where(x => x.EndedAt != null)
                : query.Where(x => x.EndedAt == null);
        }

        // Sorting
        query = parameters.SortBy.ToLower() switch
        {
            "startedat" => parameters.Descending
                ? query.OrderByDescending(x => x.StartedAt)
                : query.OrderBy(x => x.StartedAt),

            "endedat" => parameters.Descending
                ? query.OrderByDescending(x => x.EndedAt)
                : query.OrderBy(x => x.EndedAt),

            "jobapplicationid" => parameters.Descending
                ? query.OrderByDescending(x => x.JobApplicationId)
                : query.OrderBy(x => x.JobApplicationId),

            _ => parameters.Descending
                ? query.OrderByDescending(x => x.Id)
                : query.OrderBy(x => x.Id)
        };

        var totalCount = await query.CountAsync();

        var sessions = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync();

        return new PagedResult<InterviewSessionDto>
        {
            Items = sessions.Select(ToDto).ToList(),
            TotalCount = totalCount,
            PageNumber = parameters.PageNumber,
            PageSize = parameters.PageSize
        };
    }

    public async Task<InterviewSessionDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId)
    {
        var query = _context.InterviewSessions
            .AsNoTracking()
            .Where(x => x.Id == id);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(x => x.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(x => x.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var session = await query.FirstOrDefaultAsync();

        return session == null ? null : ToDto(session);
    }

    public async Task<InterviewSessionDto> CreateAsync(
        CreateInterviewSessionRequest request)
    {
        var existing = await _context.InterviewSessions
            .AsNoTracking()
            .Where(session => session.JobApplicationId == request.JobApplicationId && session.EndedAt == null)
            .OrderByDescending(session => session.StartedAt)
            .FirstOrDefaultAsync();
        
        // Only reuse existing session if the language matches the requested language
        if (existing is not null && 
            string.Equals(existing.Language, request.Language, StringComparison.OrdinalIgnoreCase))
            return ToDto(existing);

        var application = await _context.JobApplications
            .Include(item => item.Job)
            .FirstOrDefaultAsync(item => item.Id == request.JobApplicationId)
            ?? throw new InvalidOperationException("Job application not found.");

        var sessionLanguage = LanguageMap.Normalize(
            string.IsNullOrWhiteSpace(request.Language) ? application.Job.Language : request.Language);

        var session = new InterviewSession
        {
            Id = Guid.NewGuid(),
            JobApplicationId = request.JobApplicationId,
            StartedAt = request.StartedAt,
            Language = sessionLanguage
        };

        _context.InterviewSessions.Add(session);
        application.Status = ApplicationStatus.InterviewStarted;

        await _context.SaveChangesAsync();

        // ============================
        // Phase 3A — automatic interview generation
        // The job already carries its interview configuration (Experience,
        // Skills, Difficulty, Language, EstimatedDuration, Culture), so the
        // plan is generated immediately here instead of requiring HR to
        // visit the AI Interview Generator page separately. This reuses the
        // existing QuestionGenerationService (which itself reuses
        // OpenRouterService and the existing prompts) — no AI logic is
        // duplicated.
        // ============================

        await GeneratePlanForSessionAsync(session.Id, application.Job, sessionLanguage);

        return ToDto(session);
    }

    private async Task GeneratePlanForSessionAsync(Guid sessionId, Job job, string? requestLanguage)
    {
        try
        {
            var persistedLanguage = await _context.InterviewSessions
                .AsNoTracking()
                .Where(s => s.Id == sessionId)
                .Select(s => s.Language)
                .FirstOrDefaultAsync();

            var authoritativeLanguage = LanguageMap.Normalize(
                !string.IsNullOrWhiteSpace(persistedLanguage) ? persistedLanguage : requestLanguage ?? job.Language);

            var planRequest = new GenerateInterviewPlanRequest
            {
                InterviewSessionId = sessionId,
                JobTitle = job.Title,
                JobDescription = job.Description,
                RequiredSkills = string.IsNullOrWhiteSpace(job.Skills)
                    ? null
                    : job.Skills
                        .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                        .ToList(),
                ExperienceLevel = job.Experience,
                CompanyCulture = job.Culture,
                SeniorityLevel = job.Difficulty,
                InterviewDurationMinutes = job.EstimatedDuration,
                Language = authoritativeLanguage
            };

            // Scope is intentionally null here: the session was just created
            // server-side as part of this same operation, so it is trusted.
            await _questionGenerationService.GeneratePlanAsync(
                planRequest,
                scopeCompanyId: null,
                scopeCandidateUserId: null);
        }
        catch (Exception ex)
        {
            // Plan generation has its own internal fallback for AI failures;
            // this catch only guards against unexpected orchestration errors
            // so that interview session creation never fails because of it.
            // The candidate/HR can still trigger generation later via the
            // existing AI Interview Generator (advanced) page.
            _logger.LogError(ex,
                "Automatic interview plan generation failed for session {SessionId}.",
                sessionId);
        }
    }

    public async Task<bool> UpdateAsync(
        Guid id,
        UpdateInterviewSessionRequest request)
    {
        var session = await _context.InterviewSessions
            .Include(item => item.JobApplication)
            .FirstOrDefaultAsync(item => item.Id == id);

        if (session == null)
            return false;

        if (request.StartedAt.HasValue)
            session.StartedAt = request.StartedAt.Value;
        if (request.EndedAt.HasValue)
        {
            session.EndedAt = request.EndedAt;
            session.JobApplication.Status = ApplicationStatus.InterviewCompleted;
        }

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId)
    {
        var session = await _context.InterviewSessions.FindAsync(id);

        if (session == null)
            return false;

        if (scopeCompanyId.HasValue)
        {
            var inScope = await _context.InterviewSessions
                .AsNoTracking()
                .Where(x => x.Id == id)
                .AnyAsync(x => x.JobApplication.Job.CompanyId == scopeCompanyId.Value);
            if (!inScope)
                return false;
        }

        _context.InterviewSessions.Remove(session);

        await _context.SaveChangesAsync();

        return true;
    }

    private static InterviewSessionDto ToDto(InterviewSession session)
    {
        return new InterviewSessionDto
        {
            Id = session.Id,
            JobApplicationId = session.JobApplicationId,
            StartedAt = session.StartedAt,
            EndedAt = session.EndedAt,
            Language = session.Language
        };
    }
}
