using SilentInterview.Application.DTOs.Analytics;

namespace SilentInterview.Application.Interfaces;

public interface IAnalyticsService
{
    Task<AnalyticsOverviewDto> GetOverviewAsync(Guid requesterId, string role, string? period, CancellationToken cancellationToken = default);
}
