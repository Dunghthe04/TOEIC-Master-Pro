namespace ToeicMasterPro.Application.Common.Interfaces;

//Cache lưu dạng key -> JSON (GetAsync<List<Test>>("tests:all"), nếu redis có key trả về luôn, chưa có thì query DB rồi set vào cache

public interface ICacheService{
    //Lấy giá trị từ cache theo key, cho phép hủy request nếu cần (nếu user ngắt kết nối => redis timeout, không query DB)=> tiết kiệm tài nguyên)
    Task<T?> GetAsync<T>(string key, CancellationToken ct =default);

    //Lưu value vào cache với key, kèm theo thời gian sống (expiry); null= vĩnh viên
    Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default);

    //Xóa key
    Task RemoveAsync(string key, CancellationToken ct =default);

    //Kiểm tra xem key tồn tại không
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);
}