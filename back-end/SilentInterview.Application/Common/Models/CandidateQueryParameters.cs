namespace SilentInterview.Application.Common.Models;

public class CandidateQueryParameters : QueryParameters
{
    public Guid? UserId { get; set; }

    public string? Skill { get; set; }
}