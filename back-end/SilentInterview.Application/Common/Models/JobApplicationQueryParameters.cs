namespace SilentInterview.Application.Common.Models;

public class JobApplicationQueryParameters : QueryParameters
{
    public Guid? CandidateId { get; set; }

    public Guid? JobId { get; set; }

    public string? Status { get; set; }
}