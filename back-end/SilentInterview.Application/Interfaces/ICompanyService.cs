using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Company;

namespace SilentInterview.Application.Interfaces;

public interface ICompanyService
{
    Task<PagedResult<CompanyDto>> GetAllAsync(
        CompanyQueryParameters parameters,
        Guid? scopeCompanyId);

    Task<CompanyDto?> GetByIdAsync(
        Guid id,
        Guid? scopeCompanyId);

    Task<CompanyDto> CreateAsync(
        CreateCompanyRequest request,
        Guid recruiterUserId);

    Task<CompanyDto?> UpdateAsync(
        Guid id,
        UpdateCompanyRequest request,
        Guid? scopeCompanyId);

    Task<bool> DeleteAsync(
        Guid id,
        Guid? scopeCompanyId);

    Task<bool> RestoreAsync(
        Guid id,
        Guid? scopeCompanyId);
}