using System.Linq;
using System.Text.Json;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.DTOs.AI;
using SilentInterview.Application.Interfaces;
using SilentInterview.Application.Settings;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.AI.Prompts;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.AI;

/// <summary>
/// Generates the AI interview structure (sections + unique questions) for a session.
/// Replaces static/template question generation entirely — every question is produced
/// fresh by the configured OpenRouter model from real job context.
/// </summary>
public sealed class QuestionGenerationService : IQuestionGenerationService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IOpenRouterService _openRouter;
    private readonly OpenRouterSettings _settings;
    private readonly ILogger<QuestionGenerationService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public QuestionGenerationService(
        SilentInterviewDbContext context,
        IOpenRouterService openRouter,
        IOptions<OpenRouterSettings> settings,
        ILogger<QuestionGenerationService> logger)
    {
        _context = context;
        _openRouter = openRouter;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AIInterviewPlanDto> GeneratePlanAsync(
        GenerateInterviewPlanRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var session = await LoadScopedSessionAsync(
            request.InterviewSessionId, scopeCompanyId, scopeCandidateUserId, cancellationToken)
            ?? throw new InvalidOperationException("Interview session not found.");

        var job = session.JobApplication.Job;
        var candidate = session.JobApplication.Candidate;

        var jobTitle = !string.IsNullOrWhiteSpace(request.JobTitle) ? request.JobTitle! : job.Title;
        var jobDescription = !string.IsNullOrWhiteSpace(request.JobDescription) ? request.JobDescription! : job.Description;

        // Merge explicit skill overrides with the job's own skills and requirements fields.
        // Priority: request.RequiredSkills → job.Skills → job.Requirements (as fallback)
        var jobSkillsFromEntity = SplitList(job.Skills).Union(SplitList(job.Requirements)).Distinct().ToList();
        var requiredSkills = (request.RequiredSkills is { Count: > 0 } ? request.RequiredSkills : null)
            ?? (jobSkillsFromEntity.Count > 0 ? jobSkillsFromEntity : new List<string>());

        // Fall back to the job entity's own language/experience/culture/duration when the
        // request does not explicitly supply them — this is the correct behaviour when the
        // frontend sends the real job values rather than hardcoded overrides.
        // The interview session language is immutable and authoritative.
        // Never infer output language from the candidate answer or a later request.
        var language = LanguageMap.Normalize(
            !string.IsNullOrWhiteSpace(session.Language)
                ? session.Language
                : (!string.IsNullOrWhiteSpace(request.Language) ? request.Language : job.Language));
        var languageName = LanguageMap.Name(language);
        var experienceLevel = !string.IsNullOrWhiteSpace(request.ExperienceLevel)
            ? request.ExperienceLevel
            : job.Experience;
        var seniorityLevel = !string.IsNullOrWhiteSpace(request.SeniorityLevel)
            ? request.SeniorityLevel
            : job.Difficulty;
        var companyCulture = !string.IsNullOrWhiteSpace(request.CompanyCulture)
            ? request.CompanyCulture
            : job.Culture;
        var duration = request.InterviewDurationMinutes
            ?? job.EstimatedDuration
            ?? 30;

        // Log all values for debugging
        _logger.LogInformation("Generating interview plan for Session {SessionId} - JobTitle: {JobTitle}, Experience: {Experience}, Seniority: {Seniority}, Language: {Language}, Culture: {Culture}, Duration: {Duration}, Skills: {Skills}",
            session.Id, jobTitle, experienceLevel, seniorityLevel, language, companyCulture, duration, string.Join(", ", requiredSkills));

        var systemPrompt = QuestionGenerationPromptBuilder.BuildSystem(languageName);
        var userPrompt = QuestionGenerationPromptBuilder.BuildUser(
            jobTitle,
            jobDescription,
            requiredSkills,
            experienceLevel,
            companyCulture,
            seniorityLevel,
            duration,
            languageName,
            uniquenessSeed: $"{candidate.Id}-{session.Id}-{DateTime.UtcNow.Ticks}");

        AIInterviewPlanRaw raw;
        try
        {
            var content = await _openRouter.CompleteAsync(
                _settings.QuestionGenerationModel,
                systemPrompt,
                userPrompt,
                _settings.QuestionGenerationMaxTokens,
                temperature: 0.9,
                jsonMode: true,
                cancellationToken: cancellationToken);

            raw = ParsePlan(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AI interview plan generation failed for session {SessionId}. Falling back to a minimal safe plan.",
                session.Id);
            raw = BuildFallbackPlan(jobTitle, experienceLevel, seniorityLevel, companyCulture, duration, languageName, requiredSkills);
        }

        var plan = await _context.AIInterviewPlans
            .FirstOrDefaultAsync(p => p.InterviewSessionId == session.Id, cancellationToken);

        var sectionsJson = JsonSerializer.Serialize(NormalizeSections(raw.Sections), JsonOptions);

        if (plan is null)
        {
            plan = new AIInterviewPlan
            {
                Id = Guid.NewGuid(),
                InterviewSessionId = session.Id,
                CreatedAt = DateTime.UtcNow
            };
            _context.AIInterviewPlans.Add(plan);
        }

        plan.InterviewTitle = string.IsNullOrWhiteSpace(raw.InterviewTitle) ? $"{jobTitle} Interview" : raw.InterviewTitle;
        plan.Introduction = string.IsNullOrWhiteSpace(raw.Introduction) ? null : raw.Introduction;
        plan.Difficulty = string.IsNullOrWhiteSpace(raw.Difficulty) ? seniorityLevel ?? job.Difficulty ?? "Medium" : raw.Difficulty;
        plan.EstimatedDurationMinutes = raw.EstimatedDurationMinutes > 0 ? raw.EstimatedDurationMinutes : duration;
        plan.Language = language;
        plan.SectionsJson = sectionsJson;
        plan.GeneratedByModel = _settings.QuestionGenerationModel;

        await _context.SaveChangesAsync(cancellationToken);

        return ToDto(plan);
    }

    public async Task<AIInterviewPlanDto?> GetPlanAsync(
        Guid interviewSessionId,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var query = _context.AIInterviewPlans.AsNoTracking()
            .Where(p => p.InterviewSessionId == interviewSessionId);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(p => p.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(p => p.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        var plan = await query.FirstOrDefaultAsync(cancellationToken);
        return plan is null ? null : ToDto(plan);
    }

    private async Task<InterviewSession?> LoadScopedSessionAsync(
        Guid interviewSessionId,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken)
    {
        var query = _context.InterviewSessions
            .Include(s => s.JobApplication).ThenInclude(a => a.Job)
            .Include(s => s.JobApplication).ThenInclude(a => a.Candidate)
            .Where(s => s.Id == interviewSessionId);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(s => s.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(s => s.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    private static List<string> SplitList(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return new List<string>();
        return raw.Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    private static AIInterviewPlanRaw ParsePlan(string content)
    {
        var json = ExtractJson(content);
        var parsed = JsonSerializer.Deserialize<AIInterviewPlanRaw>(json, JsonOptions)
            ?? throw new InvalidOperationException("AI returned an empty interview plan.");

        if (parsed.Sections is null || parsed.Sections.Count == 0)
        {
            throw new InvalidOperationException("AI interview plan contained no sections.");
        }

        return parsed;
    }

    private static string ExtractJson(string content)
    {
        var trimmed = content.Trim();
        if (trimmed.StartsWith('{')) return trimmed;

        var start = trimmed.IndexOf('{');
        var end = trimmed.LastIndexOf('}');
        if (start >= 0 && end > start) return trimmed[start..(end + 1)];

        throw new InvalidOperationException("AI response did not contain valid JSON.");
    }

    private static List<AIInterviewSectionDto> NormalizeSections(List<AIInterviewSectionRaw> sections)
    {
        var result = new List<AIInterviewSectionDto>();
        var order = 1;

        foreach (var section in sections)
        {
            var questions = new List<AIInterviewQuestionDto>();
            foreach (var q in section.Questions ?? new List<AIInterviewQuestionRaw>())
            {
                if (q is null || string.IsNullOrWhiteSpace(q.Text)) continue;
                questions.Add(new AIInterviewQuestionDto
                {
                    Id = Guid.NewGuid().ToString("N"),
                    Order = order++,
                    Text = q.Text.Trim(),
                    DifficultyLevel = string.IsNullOrWhiteSpace(q.DifficultyLevel) ? null : q.DifficultyLevel.Trim(),
                    ExpectedAnswer = string.IsNullOrWhiteSpace(q.ExpectedAnswer) ? null : q.ExpectedAnswer.Trim(),
                    EvaluationCriteria = (q.EvaluationCriteria ?? new List<string>())
                        .Where(c => !string.IsNullOrWhiteSpace(c))
                        .Select(c => c.Trim())
                        .ToList()
                });
            }

            if (questions.Count == 0) continue;

            result.Add(new AIInterviewSectionDto
            {
                Type = string.IsNullOrWhiteSpace(section.Type) ? "technical" : section.Type,
                Questions = questions
            });
        }

        return result;
    }

    private static AIInterviewPlanRaw BuildFallbackPlan(
        string jobTitle,
        string? experienceLevel,
        string? seniorityLevel,
        string? companyCulture,
        int duration,
        string languageName,
        List<string> requiredSkills) => new()
    {
        InterviewTitle = $"{jobTitle} Interview",
        Introduction = $"Welcome — this interview will cover your background and fit for the {jobTitle} role.",
        Difficulty = seniorityLevel ?? experienceLevel ?? "Medium",
        EstimatedDurationMinutes = duration,
        Sections = new List<AIInterviewSectionRaw>
        {
            new() { Type = "technical", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = $"Walk me through your most relevant technical experience for a {jobTitle} role." +
                    (requiredSkills.Count > 0 ? $" Focus on your skills in: {string.Join(", ", requiredSkills)}." : "") } } },
            new() { Type = "behavioral", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = "Tell me about a challenging project and how you handled it." } } },
            new() { Type = "situational", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = "If you disagreed with a technical decision made by your manager, what would you do?" } } },
            new() { Type = "soft_skill", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = "How do you approach collaborating with a team you're new to?" } } },
            new() { Type = "culture_fit", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = string.IsNullOrWhiteSpace(companyCulture)
                    ? "How do you contribute to a positive team culture?"
                    : $"How would you fit in with our culture: {companyCulture}?" } } },
            new() { Type = "problem_solving", Questions = new List<AIInterviewQuestionRaw>
                { new() { Text = "Describe a time you solved a difficult problem under time pressure." } } },
        }
    };

    private static AIInterviewPlanDto ToDto(AIInterviewPlan plan) => new()
    {
        Id = plan.Id,
        InterviewSessionId = plan.InterviewSessionId,
        InterviewTitle = plan.InterviewTitle,
        Introduction = plan.Introduction,
        Difficulty = plan.Difficulty,
        EstimatedDurationMinutes = plan.EstimatedDurationMinutes,
        Language = plan.Language,
        Sections = JsonSerializer.Deserialize<List<AIInterviewSectionDto>>(plan.SectionsJson, JsonOptions)
            ?? new List<AIInterviewSectionDto>(),
        CreatedAt = plan.CreatedAt
    };

    private sealed class AIInterviewPlanRaw
    {
        public string InterviewTitle { get; set; } = string.Empty;
        public string Introduction { get; set; } = string.Empty;
        public string Difficulty { get; set; } = string.Empty;
        public int EstimatedDurationMinutes { get; set; }
        public List<AIInterviewSectionRaw> Sections { get; set; } = new();
    }

    private sealed class AIInterviewSectionRaw
    {
        public string Type { get; set; } = string.Empty;
        public List<AIInterviewQuestionRaw>? Questions { get; set; }
    }

    private sealed class AIInterviewQuestionRaw
    {
        public string Text { get; set; } = string.Empty;
        public string? DifficultyLevel { get; set; }
        public string? ExpectedAnswer { get; set; }
        public List<string>? EvaluationCriteria { get; set; }
    }
}
