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
/// Drives the live, adaptive interview. Removes static question order: after
/// each answer is evaluated, the AI decides whether to go deeper, ask a
/// clarification, or move on to the next planned question from the session's
/// AIInterviewPlan.
/// </summary>
public sealed class InterviewAIService : IInterviewAIService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IOpenRouterService _openRouter;
    private readonly OpenRouterSettings _settings;
    private readonly ILogger<InterviewAIService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public InterviewAIService(
        SilentInterviewDbContext context,
        IOpenRouterService openRouter,
        IOptions<OpenRouterSettings> settings,
        ILogger<InterviewAIService> logger)
    {
        _context = context;
        _openRouter = openRouter;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AnswerEvaluationDto> EvaluateAnswerAsync(
        EvaluateAnswerRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var answer = await LoadScopedAnswerAsync(
            request.InterviewAnswerId, scopeCompanyId, scopeCandidateUserId, cancellationToken)
            ?? throw new InvalidOperationException("Interview answer not found.");

        if (answer.InterviewSessionId != request.InterviewSessionId)
        {
            throw new InvalidOperationException("Answer does not belong to the specified interview session.");
        }

        var plan = await _context.AIInterviewPlans
            .FirstOrDefaultAsync(p => p.InterviewSessionId == request.InterviewSessionId, cancellationToken)
            ?? throw new InvalidOperationException("No AI interview plan exists for this session yet.");

        var job = answer.InterviewSession.JobApplication.Job;
        var languageName = LanguageMap.Name(plan.Language);

        var previousQuestions = await _context.InterviewAnswers
            .AsNoTracking()
            .Where(a => a.InterviewSessionId == request.InterviewSessionId && a.Order < answer.Order)
            .OrderBy(a => a.Order)
            .Select(a => a.Question)
            .ToListAsync(cancellationToken);

        var sectionType = ResolveSectionType(plan.SectionsJson, answer.Question);

        var systemPrompt = InterviewFlowPromptBuilder.BuildEvaluationSystem(languageName);
        var userPrompt = InterviewFlowPromptBuilder.BuildEvaluationUser(
            job.Title, sectionType, answer.Question, answer.Answer, previousQuestions, languageName);

        AnswerEvaluationRaw raw;
        try
        {
            var content = await _openRouter.CompleteAsync(
                _settings.InterviewFlowModel,
                systemPrompt,
                userPrompt,
                _settings.AnswerEvaluationMaxTokens,
                temperature: 0.4,
                jsonMode: true,
                cancellationToken: cancellationToken);

            raw = ParseEvaluation(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "AI answer evaluation failed for answer {AnswerId}. Falling back to a neutral evaluation.",
                answer.Id);
            raw = BuildFallbackEvaluation();
        }

        var evaluation = await _context.AIAnswerEvaluations
            .FirstOrDefaultAsync(e => e.InterviewAnswerId == answer.Id, cancellationToken);

        if (evaluation is null)
        {
            evaluation = new AIAnswerEvaluation
            {
                Id = Guid.NewGuid(),
                InterviewAnswerId = answer.Id,
                AIInterviewPlanId = plan.Id,
                CreatedAt = DateTime.UtcNow
            };
            _context.AIAnswerEvaluations.Add(evaluation);
        }

        evaluation.TechnicalAccuracy = Clamp(raw.TechnicalAccuracy);
        evaluation.CommunicationScore = Clamp(raw.CommunicationScore);
        evaluation.ConfidenceScore = Clamp(raw.ConfidenceScore);
        evaluation.ClarityScore = Clamp(raw.ClarityScore);
        evaluation.DepthScore = Clamp(raw.DepthScore);
        evaluation.KeywordsDetectedJson = JsonSerializer.Serialize(raw.KeywordsDetected ?? new List<string>(), JsonOptions);
        evaluation.StrengthsJson = JsonSerializer.Serialize(raw.Strengths ?? new List<string>(), JsonOptions);
        evaluation.WeaknessesJson = JsonSerializer.Serialize(raw.Weaknesses ?? new List<string>(), JsonOptions);
        evaluation.FollowUpNeeded = raw.FollowUpNeeded;
        evaluation.AiComment = raw.AiComment ?? string.Empty;
        evaluation.NextAction = NormalizeNextAction(raw.NextAction);
        evaluation.FollowUpQuestion = string.IsNullOrWhiteSpace(raw.FollowUpQuestion) ? null : raw.FollowUpQuestion;
        evaluation.GeneratedByModel = _settings.InterviewFlowModel;

        await _context.SaveChangesAsync(cancellationToken);

        return ToDto(evaluation);
    }

    public async Task<NextQuestionDto> GetNextQuestionAsync(
        NextQuestionRequest request,
        Guid? scopeCompanyId,
        Guid? scopeCandidateUserId,
        CancellationToken cancellationToken = default)
    {
        var session = await LoadScopedSessionAsync(
            request.InterviewSessionId, scopeCompanyId, scopeCandidateUserId, cancellationToken)
            ?? throw new InvalidOperationException("Interview session not found.");

        var plan = await _context.AIInterviewPlans
            .FirstOrDefaultAsync(p => p.InterviewSessionId == session.Id, cancellationToken)
            ?? throw new InvalidOperationException("No AI interview plan exists for this session yet.");

        var sections = JsonSerializer.Deserialize<List<AIInterviewSectionDto>>(plan.SectionsJson, JsonOptions)
            ?? new List<AIInterviewSectionDto>();
        var allPlannedQuestions = sections.SelectMany(s => s.Questions.Select(q => (Section: s.Type, Question: q))).ToList();

        var answeredQuestionTexts = await _context.InterviewAnswers
            .AsNoTracking()
            .Where(a => a.InterviewSessionId == session.Id)
            .OrderBy(a => a.Order)
            .Select(a => a.Question)
            .ToListAsync(cancellationToken);

        var totalPlannedCount = allPlannedQuestions.Count;
        var answeredCount = Math.Min(answeredQuestionTexts.Count, totalPlannedCount);

        // The interview is planned for exactly totalPlannedCount questions. Follow-ups
        // consume planned slots instead of extending the interview, so once that many
        // answers exist the interview is over regardless of which planned questions
        // were replaced by follow-ups.
        if (totalPlannedCount > 0 && answeredQuestionTexts.Count >= totalPlannedCount)
        {
            return new NextQuestionDto
            {
                QuestionId = null,
                QuestionText = null,
                SectionType = null,
                IsFollowUp = false,
                InterviewComplete = true,
                AnsweredCount = answeredCount,
                TotalPlannedCount = totalPlannedCount
            };
        }

        // Check whether the most recent answer's AI evaluation calls for a follow-up.
        if (answeredCount > 0)
        {
            var lastAnswer = await _context.InterviewAnswers
                .AsNoTracking()
                .Where(a => a.InterviewSessionId == session.Id)
                .OrderByDescending(a => a.Order)
                .FirstOrDefaultAsync(cancellationToken);

            if (lastAnswer is not null)
            {
                var lastEvaluation = await _context.AIAnswerEvaluations
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.InterviewAnswerId == lastAnswer.Id, cancellationToken);

                if (lastEvaluation is not null
                    && lastEvaluation.NextAction is "continue_deeper" or "clarify"
                    && !string.IsNullOrWhiteSpace(lastEvaluation.FollowUpQuestion)
                    && !answeredQuestionTexts.Contains(lastEvaluation.FollowUpQuestion, StringComparer.OrdinalIgnoreCase))
                {
                    var sectionType = ResolveSectionType(plan.SectionsJson, lastAnswer.Question);
                    return new NextQuestionDto
                    {
                        QuestionId = Guid.NewGuid().ToString("N"),
                        QuestionText = lastEvaluation.FollowUpQuestion,
                        SectionType = sectionType,
                        IsFollowUp = true,
                        InterviewComplete = false,
                        AnsweredCount = answeredCount,
                        TotalPlannedCount = totalPlannedCount
                    };
                }
            }
        }

        // Otherwise, move to the next unanswered planned question.
        var next = allPlannedQuestions
            .FirstOrDefault(p => !answeredQuestionTexts.Contains(p.Question.Text, StringComparer.OrdinalIgnoreCase));

        if (next.Question is null)
        {
            return new NextQuestionDto
            {
                QuestionId = null,
                QuestionText = null,
                SectionType = null,
                IsFollowUp = false,
                InterviewComplete = true,
                AnsweredCount = answeredCount,
                TotalPlannedCount = totalPlannedCount
            };
        }

        return new NextQuestionDto
        {
            QuestionId = next.Question.Id,
            QuestionText = next.Question.Text,
            SectionType = next.Section,
            IsFollowUp = false,
            InterviewComplete = false,
            AnsweredCount = answeredCount,
            TotalPlannedCount = totalPlannedCount
        };
    }

    private async Task<InterviewAnswer?> LoadScopedAnswerAsync(
        Guid answerId, Guid? scopeCompanyId, Guid? scopeCandidateUserId, CancellationToken cancellationToken)
    {
        var query = _context.InterviewAnswers
            .Include(a => a.InterviewSession).ThenInclude(s => s.JobApplication).ThenInclude(a => a.Job)
            .Include(a => a.InterviewSession).ThenInclude(s => s.JobApplication).ThenInclude(a => a.Candidate)
            .Where(a => a.Id == answerId);

        if (scopeCompanyId.HasValue)
        {
            query = query.Where(a => a.InterviewSession.JobApplication.Job.CompanyId == scopeCompanyId.Value);
        }

        if (scopeCandidateUserId.HasValue)
        {
            query = query.Where(a => a.InterviewSession.JobApplication.Candidate.UserId == scopeCandidateUserId.Value);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    private async Task<InterviewSession?> LoadScopedSessionAsync(
        Guid interviewSessionId, Guid? scopeCompanyId, Guid? scopeCandidateUserId, CancellationToken cancellationToken)
    {
        var query = _context.InterviewSessions
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

    private static string ResolveSectionType(string sectionsJson, string questionText)
    {
        try
        {
            var sections = JsonSerializer.Deserialize<List<AIInterviewSectionDto>>(sectionsJson, JsonOptions)
                ?? new List<AIInterviewSectionDto>();
            var match = sections.FirstOrDefault(s =>
                s.Questions.Any(q => string.Equals(q.Text, questionText, StringComparison.OrdinalIgnoreCase)));
            return match?.Type ?? "technical";
        }
        catch
        {
            return "technical";
        }
    }

    private static string NormalizeNextAction(string? action) => action?.Trim().ToLowerInvariant() switch
    {
        "continue_deeper" => "continue_deeper",
        "clarify" => "clarify",
        _ => "move_next"
    };

    private static int Clamp(int value) => Math.Clamp(value, 0, 100);

    private static AnswerEvaluationRaw ParseEvaluation(string content)
    {
        var json = ExtractJson(content);
        return JsonSerializer.Deserialize<AnswerEvaluationRaw>(json, JsonOptions)
            ?? throw new InvalidOperationException("AI returned an empty answer evaluation.");
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

    private static AnswerEvaluationRaw BuildFallbackEvaluation() => new()
    {
        TechnicalAccuracy = 50,
        CommunicationScore = 50,
        ConfidenceScore = 50,
        ClarityScore = 50,
        DepthScore = 50,
        KeywordsDetected = new List<string>(),
        Strengths = new List<string>(),
        Weaknesses = new List<string>(),
        FollowUpNeeded = false,
        AiComment = "Automated evaluation unavailable; scored neutrally.",
        NextAction = "move_next",
        FollowUpQuestion = null
    };

    private static AnswerEvaluationDto ToDto(AIAnswerEvaluation e) => new()
    {
        Id = e.Id,
        InterviewAnswerId = e.InterviewAnswerId,
        TechnicalAccuracy = e.TechnicalAccuracy,
        CommunicationScore = e.CommunicationScore,
        ConfidenceScore = e.ConfidenceScore,
        ClarityScore = e.ClarityScore,
        DepthScore = e.DepthScore,
        KeywordsDetected = JsonSerializer.Deserialize<List<string>>(e.KeywordsDetectedJson, JsonOptions) ?? new(),
        Strengths = JsonSerializer.Deserialize<List<string>>(e.StrengthsJson, JsonOptions) ?? new(),
        Weaknesses = JsonSerializer.Deserialize<List<string>>(e.WeaknessesJson, JsonOptions) ?? new(),
        FollowUpNeeded = e.FollowUpNeeded,
        AiComment = e.AiComment,
        NextAction = e.NextAction,
        FollowUpQuestion = e.FollowUpQuestion
    };

    private sealed class AnswerEvaluationRaw
    {
        public int TechnicalAccuracy { get; set; }
        public int CommunicationScore { get; set; }
        public int ConfidenceScore { get; set; }
        public int ClarityScore { get; set; }
        public int DepthScore { get; set; }
        public List<string>? KeywordsDetected { get; set; }
        public List<string>? Strengths { get; set; }
        public List<string>? Weaknesses { get; set; }
        public bool FollowUpNeeded { get; set; }
        public string? AiComment { get; set; }
        public string? NextAction { get; set; }
        public string? FollowUpQuestion { get; set; }
    }
}