namespace SilentInterview.Application.Common.Models;

public class ReportQueryParameters : QueryParameters
{
    public Guid? InterviewSessionId { get; set; }

    public int? MinScore { get; set; }

    public int? MaxScore { get; set; }
}