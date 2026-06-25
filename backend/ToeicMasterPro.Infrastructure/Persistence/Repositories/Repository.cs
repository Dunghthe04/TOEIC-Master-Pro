using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.Infrastructure.Persistence.Repositories;

//Controller -> Service ->IRepository<T> ->Repository<T> -> DbSet<T> -> ApplicationDb -> sql
public class Repositories<T> : IRepository<T> where T : class{
    //Làm việc trực tiếp với DbSet
    protected readonly ApplicationDbContext _context;
    //Tạo 1 con trỏ đến DbSet để làm việc với Entity T
    protected readonly DbSet<T> _dbSet; // vd Dbse<Question> -> context.Questions

    public Repositories(ApplicationDbContext context){
        _context=context;
        _dbSet=context.Set<T>();// lấy "bảng" tương ứng entity T
    }

    public async Task<T?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _dbSet.FindAsync(new object?[] { id }, ct);

    public async Task<IReadOnlyList<T>> ListAllAsync(CancellationToken ct = default)
        => await _dbSet.ToListAsync(ct);

    public async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await _dbSet.Where(predicate).ToListAsync(ct);

    public async Task AddAsync(T entity, CancellationToken ct = default)
        => await _dbSet.AddAsync(entity, ct);

    public void Update(T entity) => _dbSet.Update(entity);

    public void Remove(T entity) => _dbSet.Remove(entity);


}