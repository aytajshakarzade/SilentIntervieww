using Microsoft.EntityFrameworkCore;

using SilentInterview.Application.Common.Models;

namespace SilentInterview.Application.Common.Extensions;

public static class PaginationExtensions
{
    public static async Task<PagedResult<TDestination>> ToPagedResultAsync<TSource, TDestination>(
        this IQueryable<TSource> query,
        PaginationParameters parameters,
        Func<TSource, TDestination> selector,
        CancellationToken cancellationToken = default)
    {
        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .Skip((parameters.PageNumber - 1) * parameters.PageSize)
            .Take(parameters.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<TDestination>
        {
            Items = items.Select(selector).ToList(),

            PageNumber = parameters.PageNumber,

            PageSize = parameters.PageSize,

            TotalCount = totalCount
        };
    }
}