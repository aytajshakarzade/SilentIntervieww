namespace SilentInterview.Application.DTOs.Job;

public class JobResponse
{
    public Guid Id { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string Location { get; set; } = string.Empty;

    public decimal Salary { get; set; }

    public Guid CompanyId { get; set; }
}