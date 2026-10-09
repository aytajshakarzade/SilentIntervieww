using System.Text;
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
/// The AI HR assistant embedded in the recruiter dashboard. Answers free-form
/// questions grounded strictly in the recruiter's own company's stored
/// interview/report data — never cross-company, matching every other
/// recruiter-scoped endpoint in the platform.
/// </summary>
public sealed class AIAssistantService : IAIAssistantService
{
    private readonly SilentInterviewDbContext _context;
    private readonly IOpenRouterService _openRouter;
    private readonly OpenRouterSettings _settings;
    private readonly ILogger<AIAssistantService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AIAssistantService(
        SilentInterviewDbContext context,
        IOpenRouterService openRouter,
        IOptions<OpenRouterSettings> settings,
        ILogger<AIAssistantService> logger)
    {
        _context = context;
        _openRouter = openRouter;
        _settings = settings.Value;
        _logger = logger;
    }

    public async Task<AssistantQueryResponseDto> AskAsync(
        AssistantQueryRequest request,
        Guid scopeCompanyId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.Question))
        {
            throw new InvalidOperationException("A question is required.");
        }

        var language = LanguageMap.Normalize(request.Language);

        // A conversation has a fixed language. Once created, every turn in that
        // conversation must use the stored language, regardless of browser/UI locale.
        if (request.ConversationId.HasValue)
        {
            var conversationLanguage = await _context.AIConversations
                .AsNoTracking()
                .Where(c => c.Id == request.ConversationId.Value && c.UserId == authenticatedUserId)
                .Select(c => c.Language)
                .FirstOrDefaultAsync(cancellationToken);

            if (!string.IsNullOrWhiteSpace(conversationLanguage))
                language = LanguageMap.Normalize(conversationLanguage);
        }

        var languageName = LanguageMap.Name(language);

        var sessionsQuery = _context.InterviewSessions
            .AsNoTracking()
            .Include(s => s.JobApplication).ThenInclude(a => a.Job)
            .Include(s => s.JobApplication).ThenInclude(a => a.Candidate).ThenInclude(c => c.User)
            .Include(s => s.Report)
            .Where(s => s.JobApplication.Job.CompanyId == scopeCompanyId);

        if (request.InterviewSessionIds is { Count: > 0 })
        {
            sessionsQuery = sessionsQuery.Where(s => request.InterviewSessionIds.Contains(s.Id));
        }
        else
        {
            // No specific sessions named: ground in the company's most recently completed interviews.
            sessionsQuery = sessionsQuery
                .Where(s => s.EndedAt != null)
                .OrderByDescending(s => s.EndedAt)
                .Take(10);
        }

        var sessions = await sessionsQuery.ToListAsync(cancellationToken);

        if (sessions.Count == 0)
        {
            var noDataMsg = language switch
            {
                "az" => "Bu suala cavab vermək üçün hələlik müsahibə məlumatı yoxdur.",
                "ru" => "На данный момент нет данных о собеседованиях для ответа на этот вопрос.",
                _    => "I don't have any interview data available yet to answer that."
            };
            return new AssistantQueryResponseDto
            {
                Answer = noDataMsg,
                GroundedSessionIds = new List<Guid>(),
                GeneratedByModel = _settings.ReportModel
            };
        }

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var answers = await _context.InterviewAnswers
            .AsNoTracking()
            .Where(a => sessionIds.Contains(a.InterviewSessionId))
            .OrderBy(a => a.Order)
            .ToListAsync(cancellationToken);

        var answerIds = answers.Select(a => a.Id).ToList();
        var evaluations = await _context.AIAnswerEvaluations
            .AsNoTracking()
            .Where(e => answerIds.Contains(e.InterviewAnswerId))
            .ToListAsync(cancellationToken);
        var evaluationsByAnswer = evaluations.ToDictionary(e => e.InterviewAnswerId);
        var answersBySession = answers.GroupBy(a => a.InterviewSessionId).ToDictionary(g => g.Key, g => g.ToList());

        var groundingData = BuildGroundingData(sessions, answersBySession, evaluationsByAnswer);

        // Load conversation history for AI memory (if conversationId is provided and belongs to this user)
        List<(string Role, string Content)> conversationHistory = new();
        if (request.ConversationId.HasValue)
        {
            var owned = await _context.AIConversations
                .AnyAsync(c => c.Id == request.ConversationId.Value && c.UserId == authenticatedUserId, cancellationToken);
            if (owned)
            {
                var previousMessages = await _context.AIConversationMessages
                    .Where(m => m.ConversationId == request.ConversationId.Value)
                    .OrderBy(m => m.CreatedAt)
                    .ToListAsync(cancellationToken);
                conversationHistory = previousMessages
                    .Select(m => (m.Role, m.Content))
                    .ToList();
            }
        }

        var systemPrompt = AIAssistantPromptBuilder.BuildSystem(languageName);
        var userPrompt = AIAssistantPromptBuilder.BuildUser(request.Question, groundingData, conversationHistory);

        string answerText;
        try
        {
            answerText = await _openRouter.CompleteAsync(
                _settings.ReportModel,
                systemPrompt,
                userPrompt,
                _settings.AssistantMaxTokens,
                temperature: 0.4,
                jsonMode: false,
                cancellationToken: cancellationToken);
        }
        catch (SilentInterview.Application.Common.AINotConfiguredException)
        {
            // Re-throw so the controller can map to a clean 503 with sentinel string.
            throw;
        }
        catch (GroqAuthenticationException ex)
        {
            // Do not masquerade deterministic data as AI-generated output. The
            // recruiter should see a concise provider-status error and can retry
            // once the configured credential/provider is available again.
            _logger.LogWarning(ex, "AI provider authentication failed for company {CompanyId}.", scopeCompanyId);
            throw;
        }
        catch (GroqException ex)
        {
            _logger.LogError(ex, "AI assistant OpenRouter call failed for company {CompanyId}.", scopeCompanyId);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "AI assistant query failed for company {CompanyId}.", scopeCompanyId);
            throw;
        }

        return new AssistantQueryResponseDto
        {
            Answer = answerText,
            GroundedSessionIds = sessionIds,
            GeneratedByModel = _settings.ReportModel
        };
    }

    public async Task<List<AIConversationDto>> GetConversationsAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var conversations = await _context.AIConversations
            .Where(c => c.UserId == userId)
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .Select(c => new AIConversationDto
            {
                Id = c.Id,
                UserId = c.UserId,
                CompanyId = c.CompanyId,
                Language = c.Language,
                Title = c.Title,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt ?? c.CreatedAt,
                MessageCount = c.Messages.Count
            })
            .ToListAsync(cancellationToken);

        return conversations;
    }

    public async Task<AIConversationDto> CreateConversationAsync(
        CreateConversationRequest request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var conversation = new AIConversation
        {
            UserId = userId,
            CompanyId = request.CompanyId,
            Language = LanguageMap.Normalize(request.Language),
            Title = request.Title ?? "New Conversation"
        };

        _context.AIConversations.Add(conversation);
        await _context.SaveChangesAsync(cancellationToken);

        return new AIConversationDto
        {
            Id = conversation.Id,
            UserId = conversation.UserId,
            CompanyId = conversation.CompanyId,
            Language = conversation.Language,
            Title = conversation.Title,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt ?? conversation.CreatedAt,
            MessageCount = 0
        };
    }

    public async Task<AIConversationDto?> GetConversationAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _context.AIConversations
            .Where(c => c.Id == conversationId && c.UserId == userId)
            .Select(c => new AIConversationDto
            {
                Id = c.Id,
                UserId = c.UserId,
                CompanyId = c.CompanyId,
                Language = c.Language,
                Title = c.Title,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt ?? c.CreatedAt,
                MessageCount = c.Messages.Count
            })
            .FirstOrDefaultAsync(cancellationToken);

        return conversation;
    }

    public async Task<List<AIConversationMessageDto>> GetConversationMessagesAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Verify ownership
        var conversationExists = await _context.AIConversations
            .AnyAsync(c => c.Id == conversationId && c.UserId == userId, cancellationToken);
        
        if (!conversationExists)
        {
            throw new UnauthorizedAccessException("Conversation not found or access denied.");
        }

        var messages = await _context.AIConversationMessages
            .Where(m => m.ConversationId == conversationId)
            .OrderBy(m => m.CreatedAt)
            .Select(m => new AIConversationMessageDto
            {
                Id = m.Id,
                ConversationId = m.ConversationId,
                Role = m.Role,
                Content = m.Content,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return messages;
    }

    public async Task<AIConversationMessageDto> AddMessageAsync(
        AddMessageRequest request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Verify ownership
        var conversation = await _context.AIConversations
            .FirstOrDefaultAsync(c => c.Id == request.ConversationId && c.UserId == userId, cancellationToken);
        
        if (conversation == null)
        {
            throw new UnauthorizedAccessException("Conversation not found or access denied.");
        }

        var message = new AIConversationMessage
        {
            ConversationId = request.ConversationId,
            Role = request.Role,
            Content = request.Content
        };

        _context.AIConversationMessages.Add(message);
        
        // Update conversation timestamp
        conversation.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);

        return new AIConversationMessageDto
        {
            Id = message.Id,
            ConversationId = message.ConversationId,
            Role = message.Role,
            Content = message.Content,
            CreatedAt = message.CreatedAt
        };
    }

    public async Task DeleteConversationAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _context.AIConversations
            .FirstOrDefaultAsync(c => c.Id == conversationId && c.UserId == userId, cancellationToken);
        
        if (conversation == null)
        {
            throw new UnauthorizedAccessException("Conversation not found or access denied.");
        }

        _context.AIConversations.Remove(conversation);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<AIConversationDto> UpdateConversationAsync(
        UpdateConversationRequest request,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var conversation = await _context.AIConversations
            .FirstOrDefaultAsync(c => c.Id == request.ConversationId && c.UserId == userId, cancellationToken);
        
        if (conversation == null)
        {
            throw new UnauthorizedAccessException("Conversation not found or access denied.");
        }

        conversation.Title = request.Title;
        conversation.UpdatedAt = DateTime.UtcNow;
        
        await _context.SaveChangesAsync(cancellationToken);

        return new AIConversationDto
        {
            Id = conversation.Id,
            UserId = conversation.UserId,
            CompanyId = conversation.CompanyId,
            Language = conversation.Language,
            Title = conversation.Title,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt ?? conversation.CreatedAt,
            MessageCount = conversation.Messages.Count
        };
    }

    private static string BuildGroundingData(
        List<InterviewSession> sessions,
        Dictionary<Guid, List<InterviewAnswer>> answersBySession,
        Dictionary<Guid, AIAnswerEvaluation> evaluationsByAnswer)
    {
        var sb = new StringBuilder();

        // Limit to 3 most recent sessions to stay within token budget
        foreach (var session in sessions.Take(3))
        {
            var candidateName = session.JobApplication.Candidate.User?.FullName ?? "Unknown";
            sb.AppendLine($"[{candidateName} | {session.JobApplication.Job.Title}]");

            var report = session.Report;
            if (report is not null)
            {
                // Summary only — do NOT include full AiReportJson (too large)
                sb.AppendLine($"Score: {report.Score}/100, Grade: {report.Grade}");
            }

            if (answersBySession.TryGetValue(session.Id, out var sessionAnswers))
            {
                // Include up to 3 answers per session, with truncated text
                foreach (var answer in sessionAnswers.Take(3))
                {
                    var truncatedAnswer = TruncateText(answer.Answer, 80);
                    sb.AppendLine($"Q{answer.Order}: {answer.Question}");
                    sb.AppendLine($"A{answer.Order}: {truncatedAnswer}");
                }
            }

            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string TruncateText(string? text, int maxChars)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        return text.Length <= maxChars ? text : text[..maxChars] + "…";
    }
}
