namespace SilentInterview.Application.Common.Models;

public class InterviewAnswerQueryParameters : QueryParameters
{
    public Guid? InterviewSessionId { get; set; }

    public int? Order { get; set; }
}