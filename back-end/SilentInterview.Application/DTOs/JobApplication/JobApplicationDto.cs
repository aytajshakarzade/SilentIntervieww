namespace SilentInterview.Application.DTOs.JobApplication;

public class JobApplicationDto
{
    public Guid Id { get; set; }

    public Guid CandidateId { get; set; }

    public string CandidateName { get; set; } = string.Empty;

    public Guid JobId { get; set; }

    public string JobTitle { get; set; } = string.Empty;

    public DateTime AppliedAt { get; set; }

    public string Status { get; set; } = string.Empty;

    public IReadOnlyList<string> AvailableNextStatuses { get; set; } = [];
}
