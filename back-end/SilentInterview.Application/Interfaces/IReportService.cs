using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Report;

namespace SilentInterview.Application.Interfaces;

public interface IReportService
{
    Task<PagedResult<ReportDto>> GetAllAsync(
        ReportQueryParameters parameters, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<ReportDto?> GetByIdAsync(Guid id, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null);

    Task<ReportDto> CreateAsync(CreateReportRequest request);

    Task<ReportDto> GenerateFromInterviewAsync(Guid interviewSessionId, Guid? scopeCompanyId, Guid? scopeCandidateUserId = null, CancellationToken cancellationToken = default);

    Task<bool> UpdateAsync(Guid id, UpdateReportRequest request, Guid? scopeCompanyId);

    Task<bool> DeleteAsync(Guid id, Guid? scopeCompanyId);
}
