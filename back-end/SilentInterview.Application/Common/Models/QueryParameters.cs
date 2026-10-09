namespace SilentInterview.Application.Common.Models;

public class QueryParameters : PaginationParameters
{
    public string? Search { get; set; }

    public string SortBy { get; set; } = "id";

    public bool Descending { get; set; }

    public bool IncludeDeleted { get; set; } = false;

    public bool OnlyDeleted { get; set; } = false;
}