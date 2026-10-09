namespace SilentInterview.Application.DTOs.Report;

public class UpdateReportRequest
{
    public int Score { get; set; }

    public string Feedback { get; set; } = string.Empty;
}
