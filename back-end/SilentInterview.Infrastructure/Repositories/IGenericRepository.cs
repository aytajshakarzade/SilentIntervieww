using System.Linq.Expressions;

namespace SilentInterview.Infrastructure.Repositories;

public interface IGenericRepository<TEntity>
    where TEntity : class
{
    Task<TEntity?> GetByIdAsync(Guid id);

    Task<List<TEntity>> GetAllAsync();

    Task<List<TEntity>> FindAsync(
        Expression<Func<TEntity, bool>> predicate);

    Task AddAsync(TEntity entity);

    void Update(TEntity entity);

    void Delete(TEntity entity);

    IQueryable<TEntity> Query();
}