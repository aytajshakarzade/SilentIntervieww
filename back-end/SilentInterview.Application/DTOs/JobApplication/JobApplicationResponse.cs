namespace SilentInterview.Application.DTOs.JobApplication;

public class JobApplicationResponse
{
    public Guid Id { get; set; }

    public Guid JobId { get; set; }

    public Guid CandidateId { get; set; }

    public DateTime AppliedAt { get; set; }

    public string Status { get; set; } = string.Empty;
}