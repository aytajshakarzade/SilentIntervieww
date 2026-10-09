using SilentInterview.Application.DTOs.AI;

namespace SilentInterview.Application.Interfaces;

/// <summary>
/// The AI HR assistant used inside the recruiter dashboard. Answers free-form
/// questions ("why was this candidate rejected", "compare these candidates",
/// "who is better for this role") grounded in the recruiter's own stored
/// interview/report data — scoped to their company, same as every other
/// recruiter-facing endpoint.
/// </summary>
public interface IAIAssistantService
{
    Task<AssistantQueryResponseDto> AskAsync(
        AssistantQueryRequest request,
        Guid scopeCompanyId,
        Guid authenticatedUserId,
        CancellationToken cancellationToken = default);
    
    Task<List<AIConversationDto>> GetConversationsAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task<AIConversationDto> CreateConversationAsync(
        CreateConversationRequest request,
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task<AIConversationDto?> GetConversationAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task<List<AIConversationMessageDto>> GetConversationMessagesAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task<AIConversationMessageDto> AddMessageAsync(
        AddMessageRequest request,
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task DeleteConversationAsync(
        Guid conversationId,
        Guid userId,
        CancellationToken cancellationToken = default);
    
    Task<AIConversationDto> UpdateConversationAsync(
        UpdateConversationRequest request,
        Guid userId,
        CancellationToken cancellationToken = default);
}
