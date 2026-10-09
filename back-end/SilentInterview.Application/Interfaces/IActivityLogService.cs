using SilentInterview.Application.DTOs.Activity;

namespace SilentInterview.Application.Interfaces;

public interface IActivityLogService
{
    Task<IReadOnlyList<ActivityLogDto>> GetRecentForCompanyAsync(Guid? companyId, int take, CancellationToken cancellationToken = default);
    Task RecordApplicationEventAsync(Guid applicationId, Guid? actorUserId, string action, string description, CancellationToken cancellationToken = default);
}
