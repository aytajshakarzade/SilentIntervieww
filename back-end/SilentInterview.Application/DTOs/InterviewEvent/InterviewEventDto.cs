namespace SilentInterview.Application.DTOs.InterviewEvent;

public sealed class InterviewEventDto
{
    public Guid Id { get; init; }
    public Guid InterviewSessionId { get; init; }
    public string Type { get; init; } = string.Empty;
    public string Detail { get; init; } = string.Empty;
    public DateTime OccurredAt { get; init; }
}
