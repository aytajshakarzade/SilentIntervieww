using System.Security.Claims;

using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Subscriptions;
using SilentInterview.Api.Controllers.Base.Scoping;
using Microsoft.Extensions.Logging;
using SilentInterview.Application.Common;
using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.DTOs.AI;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.Persistence;
using SilentInterview.Infrastructure.AI;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// AI-driven interview creation, adaptive question flow, answer evaluation,
/// enterprise report generation, and the recruiter AI HR assistant.
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class AIInterviewController : BaseApiController
{
    private readonly IQuestionGenerationService _questionGenerationService;
    private readonly IInterviewAIService _interviewAIService;
    private readonly IReportAIService _reportAIService;
    private readonly IAIAssistantService _assistantService;
    private readonly IOpenRouterService _openRouterService;
    private readonly IConfiguration _configuration;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;
    private readonly ILogger<AIInterviewController> _logger;

    public AIInterviewController(
        IQuestionGenerationService questionGenerationService,
        IInterviewAIService interviewAIService,
        IReportAIService reportAIService,
        IAIAssistantService assistantService,
        IOpenRouterService openRouterService,
        IConfiguration configuration,
        SilentInterviewDbContext context,
        IUserScopeResolver scopeResolver,
        ILogger<AIInterviewController> logger)
    {
        _questionGenerationService = questionGenerationService;
        _interviewAIService = interviewAIService;
        _reportAIService = reportAIService;
        _assistantService = assistantService;
        _openRouterService = openRouterService;
        _configuration = configuration;
        _context = context;
        _scopeResolver = scopeResolver;
        _logger = logger;
    }

    /// <summary>Generate (or regenerate) the AI interview structure for a session.</summary>
    [HttpPost("plan")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GeneratePlan(
        GenerateInterviewPlanRequest request, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;
        var userIdForLimit = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        try
        {
            await TryConsumeAiActionAsync(userIdForLimit, "AI actions");
            var plan = await _questionGenerationService.GeneratePlanAsync(
                request, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            return Success(plan, "AI interview plan generated successfully.");
        }
        catch (PlanLimitException ex)
        {
            return Failure(ex.Message, StatusCodes.Status402PaymentRequired);
        }
        catch (InvalidOperationException ex)
        {
            return Failure(ex.Message, StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Get the AI interview structure previously generated for a session.</summary>
    [HttpGet("plan/{interviewSessionId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPlan(Guid interviewSessionId, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;

        var plan = await _questionGenerationService.GetPlanAsync(
            interviewSessionId, scope.CompanyId, scope.CandidateUserId, cancellationToken);

        if (plan is null)
        {
            // The session can legitimately exist without a plan when automatic
            // generation was interrupted (for example during provider/model
            // startup). Regenerate it here instead of making the candidate
            // see a misleading 404. The question-generation service already
            // has a safe fallback plan when the AI provider is unavailable.
            var sessionQuery = _context.InterviewSessions
                .Include(s => s.JobApplication)
                    .ThenInclude(a => a.Job)
                .Include(s => s.JobApplication)
                    .ThenInclude(a => a.Candidate)
                .Where(s => s.Id == interviewSessionId);

            if (scope.CompanyId.HasValue)
                sessionQuery = sessionQuery.Where(s => s.JobApplication.Job.CompanyId == scope.CompanyId.Value);

            if (scope.CandidateUserId.HasValue)
                sessionQuery = sessionQuery.Where(s => s.JobApplication.Candidate.UserId == scope.CandidateUserId.Value);

            var session = await sessionQuery.FirstOrDefaultAsync(cancellationToken);
            if (session is not null)
            {
                var fallbackUserId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                try
                {
                    await TryConsumeAiActionAsync(fallbackUserId, "AI actions");
                }
                catch (PlanLimitException ex)
                {
                    return Failure(ex.Message, StatusCodes.Status402PaymentRequired);
                }
                var job = session.JobApplication.Job;
                var request = new GenerateInterviewPlanRequest
                {
                    InterviewSessionId = session.Id,
                    JobTitle = job.Title,
                    JobDescription = job.Description,
                    RequiredSkills = string.IsNullOrWhiteSpace(job.Skills)
                        ? null
                        : job.Skills.Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList(),
                    ExperienceLevel = job.Experience,
                    CompanyCulture = job.Culture,
                    SeniorityLevel = job.Difficulty,
                    InterviewDurationMinutes = job.EstimatedDuration,
                    Language = session.Language
                };

                plan = await _questionGenerationService.GeneratePlanAsync(
                    request, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            }
        }

        if (plan is null)
            return Failure("AI interview plan could not be created.", StatusCodes.Status503ServiceUnavailable);

        return Success(plan, "AI interview plan retrieved successfully.");
    }

    /// <summary>Get the next question the AI interviewer should ask (follow-up or next planned question).</summary>
    [HttpPost("next-question")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetNextQuestion(
        NextQuestionRequest request, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;

        try
        {
            var next = await _interviewAIService.GetNextQuestionAsync(
                request, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            return Success(next, "Next question resolved successfully.");
        }
        catch (PlanLimitException ex)
        {
            return Failure(ex.Message, StatusCodes.Status402PaymentRequired);
        }
        catch (InvalidOperationException ex)
        {
            return Failure(ex.Message, StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Evaluate a single submitted answer: correctness, confidence, depth, communication.</summary>
    [HttpPost("evaluate-answer")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> EvaluateAnswer(
        EvaluateAnswerRequest request, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;

        try
        {
            var evaluation = await _interviewAIService.EvaluateAnswerAsync(
                request, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            return Success(evaluation, "Answer evaluated successfully.");
        }
        catch (InvalidOperationException ex)
        {
            return Failure(ex.Message, StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Generate (or regenerate) the enterprise AI hiring report for a completed session.</summary>
    [HttpPost("report")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GenerateReport(
        GenerateAIReportRequest request, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;
        var userIdForLimit = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        try
        {
            await TryConsumeAiActionAsync(userIdForLimit, "AI actions");
            var report = await _reportAIService.GenerateAsync(
                request, scope.CompanyId, scope.CandidateUserId, cancellationToken);
            return Success(report, "AI hiring report generated successfully.");
        }
        catch (PlanLimitException ex)
        {
            return Failure(ex.Message, StatusCodes.Status402PaymentRequired);
        }
        catch (InvalidOperationException ex)
        {
            return Failure(ex.Message, StatusCodes.Status400BadRequest);
        }
    }

    /// <summary>Get the previously generated enterprise AI hiring report for a session.</summary>
    [HttpGet("report/{interviewSessionId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetReport(Guid interviewSessionId, CancellationToken cancellationToken)
    {
        var scope = await _scopeResolver.GetScopeAsync(this);
        if (scope.IsError) return scope.Error!;

        var report = await _reportAIService.GetAsync(
            interviewSessionId, scope.CompanyId, scope.CandidateUserId, cancellationToken);

        if (report is null)
            return Failure("AI hiring report not found.", StatusCodes.Status404NotFound);

        return Success(report, "AI hiring report retrieved successfully.");
    }

    /// <summary>Ask the AI HR assistant a question, grounded in the recruiter's own company data.</summary>
    [HttpPost("assistant")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> AskAssistant(
        AssistantQueryRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? companyId;

        if (User.IsInRole("SuperAdmin"))
        {
            // SuperAdmins may query across companies only when explicit session ids are supplied;
            // otherwise there is no single company scope to ground a "recent interviews" query in.
            if (request.InterviewSessionIds is not { Count: > 0 })
                return Failure("SuperAdmins must specify interviewSessionIds for the AI assistant.", StatusCodes.Status400BadRequest);

            var firstSessionCompanyId = await _context.InterviewSessions
                .Where(s => request.InterviewSessionIds.Contains(s.Id))
                .Select(s => (Guid?)s.JobApplication.Job.CompanyId)
                .FirstOrDefaultAsync(cancellationToken);

            companyId = firstSessionCompanyId;
        }
        else
        {
            companyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        if (!companyId.HasValue)
            return Failure("Recruiter profile not found.", StatusCodes.Status403Forbidden);

        try
        {
            await TryConsumeAiActionAsync(userId, "AI assistant messages", assistant: true);
            var response = await _assistantService.AskAsync(request, companyId.Value, userId, cancellationToken);
            return Success(response, "AI assistant responded successfully.");
        }
        catch (PlanLimitException ex)
        {
            return Failure(ex.Message, StatusCodes.Status402PaymentRequired);
        }
        catch (AINotConfiguredException)
        {
            // Return a clean, localized message — never expose the raw key name.
            // The frontend localizes this based on the user's language.
            return Failure("AI_NOT_CONFIGURED", StatusCodes.Status503ServiceUnavailable);
        }
        catch (GroqAuthenticationException)
        {
            _logger.LogWarning("AI provider rejected the configured credential for company {CompanyId}.", companyId);
            return Failure("AI_PROVIDER_AUTH_FAILED", StatusCodes.Status503ServiceUnavailable);
        }
        catch (GroqException ex)
        {
            _logger.LogWarning(ex, "AI provider is unavailable for company {CompanyId}.", companyId);
            return Failure("AI_PROVIDER_UNAVAILABLE", StatusCodes.Status503ServiceUnavailable);
        }
        catch (InvalidOperationException ex)
        {
            return Failure(ex.Message, StatusCodes.Status400BadRequest);
        }
        catch (Exception ex)
        {
            // Log the FULL exception so docker compose logs api shows the real Groq error.
            _logger.LogError(ex,
                "AI assistant FAILED for company {CompanyId}. Type={ExType} Message={ExMsg}",
                companyId, ex.GetType().Name, ex.Message);

            return Failure("AI_PROVIDER_UNAVAILABLE", StatusCodes.Status503ServiceUnavailable);
        }
    }

    // ── Diagnostic endpoint ────────────────────────────────────────────────────

    /// <summary>
    /// Pings the Groq API directly with a single-token request.
    /// Useful for verifying GROQ_API_KEY is set and the model is reachable.
    /// GET /api/v1/AIInterview/assistant/ping
    /// </summary>
    [HttpGet("assistant/ping")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    public async Task<IActionResult> PingAI(CancellationToken cancellationToken)
    {
        try
        {
            var result = await _openRouterService.CompleteAsync(
                model: _configuration["OpenRouter:ReportModel"] ?? "openai/gpt-oss-120b",
                systemPrompt: "You are a test assistant. Reply with exactly: OK",
                userPrompt: "ping",
                maxTokens: 10,
                temperature: 0.0,
                jsonMode: false,
                cancellationToken: cancellationToken);

            return Success(new { status = "ok", response = result }, "Groq reachable.");
        }
        catch (SilentInterview.Application.Common.AINotConfiguredException)
        {
            return Failure("AI_NOT_CONFIGURED", StatusCodes.Status503ServiceUnavailable);
        }
        catch (GroqAuthenticationException)
        {
            return Failure("AI_PROVIDER_AUTH_FAILED", StatusCodes.Status503ServiceUnavailable);
        }
        catch (GroqException ex)
        {
            _logger.LogWarning(ex, "AI ping failed because the provider is unavailable.");
            return Failure("AI_PROVIDER_UNAVAILABLE", StatusCodes.Status503ServiceUnavailable);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI ping failed: {Msg}", ex.Message);
            return Failure("AI_PROVIDER_UNAVAILABLE", StatusCodes.Status503ServiceUnavailable);
        }
    }

    // ── AI Conversation Management Endpoints ───────────────────────────────────

    /// <summary>Get all conversations for the authenticated user.</summary>
    [HttpGet("assistant/conversations")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetConversations(CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var conversations = await _assistantService.GetConversationsAsync(userId, cancellationToken);
        return Success(conversations, "Conversations retrieved successfully.");
    }

    /// <summary>Create a new conversation.</summary>
    [HttpPost("assistant/conversations")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateConversation(
        CreateConversationRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        Guid? companyId = null;
        if (!User.IsInRole("SuperAdmin"))
        {
            companyId = await _context.Recruiters
                .Where(r => r.UserId == userId)
                .Select(r => (Guid?)r.CompanyId)
                .FirstOrDefaultAsync(cancellationToken);
        }

        request.CompanyId = companyId;
        var conversation = await _assistantService.CreateConversationAsync(request, userId, cancellationToken);
        return Success(conversation, "Conversation created successfully.");
    }

    /// <summary>Get a specific conversation by ID.</summary>
    [HttpGet("assistant/conversations/{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetConversation(Guid id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        var conversation = await _assistantService.GetConversationAsync(id, userId, cancellationToken);
        if (conversation == null)
            return Failure("Conversation not found.", StatusCodes.Status404NotFound);

        return Success(conversation, "Conversation retrieved successfully.");
    }

    /// <summary>Get all messages in a conversation.</summary>
    [HttpGet("assistant/conversations/{id:guid}/messages")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetConversationMessages(Guid id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        try
        {
            var messages = await _assistantService.GetConversationMessagesAsync(id, userId, cancellationToken);
            return Success(messages, "Messages retrieved successfully.");
        }
        catch (UnauthorizedAccessException)
        {
            return Failure("Conversation not found or access denied.", StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Add a message to a conversation.</summary>
    [HttpPost("assistant/conversations/{id:guid}/messages")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AddMessage(Guid id, AddMessageRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        request.ConversationId = id;
        try
        {
            var message = await _assistantService.AddMessageAsync(request, userId, cancellationToken);
            return Success(message, "Message added successfully.");
        }
        catch (UnauthorizedAccessException)
        {
            return Failure("Conversation not found or access denied.", StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Delete a conversation.</summary>
    [HttpDelete("assistant/conversations/{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteConversation(Guid id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        try
        {
            await _assistantService.DeleteConversationAsync(id, userId, cancellationToken);
            return Success(true, "Conversation deleted successfully.");
        }
        catch (UnauthorizedAccessException)
        {
            return Failure("Conversation not found or access denied.", StatusCodes.Status404NotFound);
        }
    }

    /// <summary>Update conversation title.</summary>
    [HttpPut("assistant/conversations/{id:guid}")]
    [Authorize(Roles = "Recruiter,SuperAdmin")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateConversation(Guid id, UpdateConversationRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);

        request.ConversationId = id;
        try
        {
            var conversation = await _assistantService.UpdateConversationAsync(request, userId, cancellationToken);
            return Success(conversation, "Conversation updated successfully.");
        }
        catch (UnauthorizedAccessException)
        {
            return Failure("Conversation not found or access denied.", StatusCodes.Status404NotFound);
        }
    }

    /// <summary>
    /// Return the canonical lists of experience levels, difficulty levels, languages,
    /// and durations supported by the AI interview engine.
    /// Frontend consumes this so option lists are never hardcoded in the UI.
    /// </summary>
    [HttpGet("config")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult GetConfig()
    {
        var config = new
        {
            ExperienceLevels = new[] { "Junior", "Mid", "Senior", "Lead", "Staff", "Principal" },
            DifficultyLevels = new[] { "easy", "medium", "hard" },
            SupportedLanguages = new[]
            {
                new { Value = "en", Label = "English" },
                new { Value = "az", Label = "Azərbaycan dili" },
                new { Value = "ru", Label = "Русский" }
            },
            EstimatedDurations = new[] { 15, 20, 30, 45, 60 }
        };
        return Success(config, "AI interview configuration retrieved successfully.");
    }


    private async Task<bool> TryConsumeAiActionAsync(Guid userId, string feature, bool assistant = false)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return false;

        var plan = PlanLimits.EffectivePlan(user.Plan, user.SubscriptionCurrentPeriodEnd);
        if (assistant && !PlanLimits.HasAssistant(plan))
            throw new PlanLimitException("AI HR Assistant is available on Go and Pro plans. Upgrade your plan to continue.");

        var limit = assistant
            ? PlanLimits.AssistantMessagesPerMonth(plan)
            : PlanLimits.AiActionsPerMonth(plan);

        if (limit < 0) return true;

        var monthStart = PlanLimits.MonthStartUtc();
        var generatedPlans = await _context.AIInterviewPlans.CountAsync(x => x.CreatedAt >= monthStart &&
            (User.IsInRole("Candidate")
                ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)));
        var reports = await _context.Reports.CountAsync(x => x.CreatedAt >= monthStart &&
            (User.IsInRole("Candidate")
                ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)));
        var assistantMessages = await _context.AIConversationMessages.CountAsync(x => x.CreatedAt >= monthStart && x.Role == "user" &&
            x.Conversation != null && x.Conversation.UserId == userId);

        // Keep the two quotas independent: AI interview/report generations
        // consume AI actions, while HR Assistant chat messages consume the
        // dedicated assistant allowance. This makes the advertised Free/Go/Pro
        // limits real instead of double-counting assistant usage.
        var used = assistant ? assistantMessages : generatedPlans + reports;
        if (used >= limit)
            throw new PlanLimitException($"You have reached the {plan} plan's monthly {feature} limit. Upgrade your plan to continue.");

        return true;
    }

    private sealed class PlanLimitException : Exception
    {
        public PlanLimitException(string message) : base(message) { }
    }

}
