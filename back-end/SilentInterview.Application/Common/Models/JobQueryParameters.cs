using SilentInterview.Application.Common.Models;

namespace SilentInterview.Application.Common.Models;

public class JobQueryParameters : PaginationParameters
{
    public string? Search { get; set; }

    public Guid? CompanyId { get; set; }

    public decimal? MinSalary { get; set; }

    public decimal? MaxSalary { get; set; }

    public string SortBy { get; set; } = "title";

    public bool Descending { get; set; } = false;
    public bool IncludeDeleted { get; set; } = false;
    public bool OnlyDeleted { get; set; } = false;
}