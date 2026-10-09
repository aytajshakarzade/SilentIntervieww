namespace SilentInterview.Application.DTOs.InterviewSession;

public class InterviewSessionDto
{
    public Guid Id { get; set; }

    public Guid JobApplicationId { get; set; }

    public DateTime StartedAt { get; set; }

    public DateTime? EndedAt { get; set; }

    public string? Language { get; set; }
}