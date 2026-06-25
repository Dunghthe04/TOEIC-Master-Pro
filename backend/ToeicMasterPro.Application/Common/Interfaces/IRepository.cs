using System.Linq.Expressions;

namespace ToeicMasterPro.Application.Common.Interfaces;

//Mục đích là Interface dùng chung cho các Model(Question, Test, Vocabulary...) , tránh lặp codeEFCore

// T là entity bất kỳ (Question, Test, Vocabulary...). "where T : class" để dùng được với DbSet<T>.
public interface IRepository<T> where T: class{
    //lấy 1 entity theo khóa chính (Guid)
    Task<T?> GetByIdAsync(Guid id, CancellationToken ct =default);

    //lấy tất cả
    //IReadOnlyList: List chỉ đọc (không được thêm/xóa phần tử trong code), dùng khi query DB xong trả về cho tầng Services
    Task<IReadOnlyList<T>> ListAllAsync(CancellationToken ct= default);

    //Lấy theo điều kiện lọc vd FindAsync(q=>q.part1)
    Task<IReadOnlyList<T>> FindAsync(Expression<Func<T,bool>> predicate, CancellationToken ct=default);

    //Thêm mới(chưa lưu Db- chỉ đánh dáu, chờ Savechanges)
    Task AddAsync(T entity, CancellationToken ct=default);

    //Cập nhập/ xóa (cũng chỉ đánh dấu)
    void Update(T entity);
    void Remove(T entity);

}