namespace SilentInterview.Application.Common.Models;

public class RecruiterQueryParameters : QueryParameters
{
    public Guid? UserId { get; set; }

    public Guid? CompanyId { get; set; }
}