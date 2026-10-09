using Microsoft.EntityFrameworkCore.Storage;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly SilentInterviewDbContext _context;

    private IDbContextTransaction? _transaction;

    public UnitOfWork(
        SilentInterviewDbContext context)
    {
        _context = context;
    }

    public async Task<int> SaveChangesAsync()
    {
        return await _context.SaveChangesAsync();
    }

    public async Task BeginTransactionAsync()
    {
        _transaction = await _context.Database.BeginTransactionAsync();
    }

    public async Task CommitTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.CommitAsync();
        }
    }

    public async Task RollbackTransactionAsync()
    {
        if (_transaction != null)
        {
            await _transaction.RollbackAsync();
        }
    }
}