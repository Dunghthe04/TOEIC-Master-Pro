using System.Collections.Concurrent;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Infrastructure.Persistence.Repositories;

namespace ToeicMasterPro.Infrastructure.Persistence;
public class UnitOfWork : IUnitOfWork{
    private readonly ApplicationDbContext _context;

    //Lưu repos đã tạo: tránh tạo lại mỗi lần gọi => memory efficient
    private readonly ConcurrentDictionary<Type,object> _repositories = new();

    public UnitOfWork(ApplicationDbContext context)
    {
        _context = context;
    }

    //Lấy repository cho entity T ( ví dụ Repository<Question>)
    public IRepository<T> Repository<T>() where T: class{
      // Đã có repo cho T thì lấy lại; chưa có thì tạo Repository<T> dùng CHUNG _context
      //Nêu Typeof<T> đã có trong _repositories thì trả về, còn chưa có thì tạo new Repositories<Question>(_context) và lưu vào _repositories
      return (IRepository<T>)_repositories.GetOrAdd(typeof(T),new Repositories<T>(_context));
    }

    //Lưu tất cả thay đổi đang chờ xuống DB trong 1 transaction, trả số dòng bị ảnh hưởng
    public async Task<int> SaveChangesAsync(CancellationToken ct= default){
      // EF tự bọc mọi thay đổi đang chờ vào 1 transaction
      return await _context.SaveChangesAsync(ct);
    }
}