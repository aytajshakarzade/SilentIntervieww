namespace SilentInterview.Infrastructure.Repositories;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync();

    Task BeginTransactionAsync();

    Task CommitTransactionAsync();

    Task RollbackTransactionAsync();
}