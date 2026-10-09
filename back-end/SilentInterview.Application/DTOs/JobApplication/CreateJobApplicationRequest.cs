namespace SilentInterview.Application.DTOs.JobApplication;

public class CreateJobApplicationRequest
{
    public Guid CandidateId { get; set; }

    public Guid JobId { get; set; }
}