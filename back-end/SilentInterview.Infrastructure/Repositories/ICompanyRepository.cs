using SilentInterview.Domain.Entities;

namespace SilentInterview.Infrastructure.Repositories;

public interface ICompanyRepository : IGenericRepository<Company>
{
    Task<Company?> GetByNameAsync(string name);

    Task<bool> ExistsAsync(string name);
}