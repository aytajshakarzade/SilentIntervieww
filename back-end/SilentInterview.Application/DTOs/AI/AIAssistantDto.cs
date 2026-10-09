namespace SilentInterview.Application.DTOs.AI;

public sealed class AssistantQueryRequest
{
    public string Question { get; set; } = string.Empty;

    /// <summary>Optional interview session ids the recruiter wants the assistant to ground its answer in
    /// (e.g. one for "why did AI reject this candidate", two+ for "compare these candidates").</summary>
    public List<Guid>? InterviewSessionIds { get; set; }

    /// <summary>"az", "en", or "ru". Defaults to "en".</summary>
    public string? Language { get; set; }

    /// <summary>
    /// Optional: the conversation this message belongs to.
    /// When supplied, previous messages from this conversation are loaded and
    /// injected into the AI prompt so the model remembers earlier turns.
    /// </summary>
    public Guid? ConversationId { get; set; }
}

public sealed class AssistantQueryResponseDto
{
    public string Answer { get; set; } = string.Empty;

    public List<Guid> GroundedSessionIds { get; set; } = new();

    public string GeneratedByModel { get; set; } = string.Empty;
}

public sealed class CreateConversationRequest
{
    public string? Title { get; set; }
    public string Language { get; set; } = "en";
    public Guid? CompanyId { get; set; }
}

public sealed class UpdateConversationRequest
{
    public Guid ConversationId { get; set; }
    public string Title { get; set; } = string.Empty;
}

public sealed class AddMessageRequest
{
    public Guid ConversationId { get; set; }
    public string Role { get; set; } = string.Empty; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
}

public sealed class AIConversationDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid? CompanyId { get; set; }
    public string Language { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int MessageCount { get; set; }
}

public sealed class AIConversationMessageDto
{
    public Guid Id { get; set; }
    public Guid ConversationId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
