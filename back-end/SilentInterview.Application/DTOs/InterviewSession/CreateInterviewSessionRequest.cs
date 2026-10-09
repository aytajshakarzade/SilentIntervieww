namespace SilentInterview.Application.DTOs.InterviewSession;

public class CreateInterviewSessionRequest
{
    public Guid JobApplicationId { get; set; }

    public DateTime StartedAt { get; set; }

    /// <summary>"az", "en", or "ru". The language selected for this interview session.</summary>
    public string? Language { get; set; }
}