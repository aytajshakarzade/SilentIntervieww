namespace SilentInterview.Application.DTOs.Report;

public class CreateReportRequest
{
    public Guid InterviewSessionId { get; set; }

    public int Score { get; set; }

    public string Feedback { get; set; } = string.Empty;
}
