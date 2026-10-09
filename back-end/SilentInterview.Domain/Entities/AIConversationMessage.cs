using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

/// <summary>
/// Represents a single message in an AI conversation.
/// Messages are ordered by creation time and belong to a specific conversation.
/// </summary>
public class AIConversationMessage : AuditableEntity
{
    public new Guid Id { get; set; }
    
    /// <summary>
    /// The conversation this message belongs to.
    /// </summary>
    public Guid ConversationId { get; set; }
    
    /// <summary>
    /// The role of the message sender: "user" or "assistant".
    /// </summary>
    public string Role { get; set; } = string.Empty;
    
    /// <summary>
    /// The content of the message.
    /// </summary>
    public string Content { get; set; } = string.Empty;
    
    /// <summary>
    /// Navigation property to the conversation.
    /// </summary>
    public AIConversation? Conversation { get; set; }
}