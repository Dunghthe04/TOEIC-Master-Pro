//Add/Update/Remove của Repository chỉ đánh dấu, chưa lưu DB. Cần chỗ "lưu thật" — đó là SaveChanges.
//IUnitOfWork — cung cấp Repository<T>() + SaveChangesAsync().
namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IUnitOfWork{
    //Lấy repository cho entity T ( ví dụ Repository<Question>)
    IRepository<T> Repository<T>() where T: class;

    //Lưu tất cả thay đổi đang chờ xuống DB trong 1 transaction, trả số dòng bị ảnh hưởng
    Task<int> SaveChangesAsync(CancellationToken ct= default);
}