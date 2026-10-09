namespace SilentInterview.Application.Common.Models;

public class InterviewSessionQueryParameters : QueryParameters
{
    public Guid? JobApplicationId { get; set; }

    public DateTime? StartedAfter { get; set; }

    public DateTime? StartedBefore { get; set; }

    public bool? IsCompleted { get; set; }
}