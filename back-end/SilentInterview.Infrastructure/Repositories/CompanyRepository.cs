using Microsoft.EntityFrameworkCore;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Repositories;

public class CompanyRepository
    : GenericRepository<Company>, ICompanyRepository
{
    public CompanyRepository(
        SilentInterviewDbContext context)
        : base(context)
    {
    }

    public async Task<Company?> GetByNameAsync(string name)
    {
        return await DbSet.FirstOrDefaultAsync(x => x.Name == name);
    }

    public async Task<bool> ExistsAsync(string name)
    {
        return await DbSet.AnyAsync(x => x.Name == name);
    }
}