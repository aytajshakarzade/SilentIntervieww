using SilentInterview.Domain.Common;

namespace SilentInterview.Domain.Entities;

/// <summary>
/// Represents a conversation between a user and the AI HR assistant.
/// Each conversation is scoped to a specific user and optionally a company.
/// </summary>
public class AIConversation : AuditableEntity
{
    public new Guid Id { get; set; }
    
    /// <summary>
    /// The user who owns this conversation. This ensures user-level isolation.
    /// </summary>
    public Guid UserId { get; set; }
    
    /// <summary>
    /// Optional company ID for company-level data scoping.
    /// Null for admins or when not applicable.
    /// </summary>
    public Guid? CompanyId { get; set; }
    
    /// <summary>
    /// The language used for this conversation (az, en, ru).
    /// </summary>
    public string Language { get; set; } = "en";
    
    /// <summary>
    /// User-friendly title for the conversation (auto-generated from first message or user-editable).
    /// </summary>
    public string Title { get; set; } = string.Empty;
    
    /// <summary>
    /// Navigation property to the user.
    /// </summary>
    public User? User { get; set; }
    
    /// <summary>
    /// Navigation property to the company (if applicable).
    /// </summary>
    public Company? Company { get; set; }
    
    /// <summary>
    /// Messages in this conversation.
    /// </summary>
    public ICollection<AIConversationMessage> Messages { get; set; } = new List<AIConversationMessage>();
}