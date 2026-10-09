namespace SilentInterview.Application.DTOs.Candidate;

public class CreateCandidateRequest
{
    public Guid UserId { get; set; }

    public string ResumeUrl { get; set; } = string.Empty;

    public string Skills { get; set; } = string.Empty;

    public string Education { get; set; } = string.Empty;

    public string Experience { get; set; } = string.Empty;
}