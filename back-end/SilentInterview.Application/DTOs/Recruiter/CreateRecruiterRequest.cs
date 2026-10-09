namespace SilentInterview.Application.DTOs.Recruiter;

public class CreateRecruiterRequest
{
    public Guid UserId { get; set; }

    public Guid CompanyId { get; set; }
}