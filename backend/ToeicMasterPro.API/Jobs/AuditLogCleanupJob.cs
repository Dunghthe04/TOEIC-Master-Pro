using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.API.Jobs;

/// <summary>
/// Dọn nhật ký cũ (HM-5).
///
/// VÌ SAO CẦN: log Security sinh MỘT DÒNG MỖI LẦN có ai thử đăng nhập — kể cả thất bại.
/// Không dọn thì bảng phình vô hạn, và chính bảng đó lại là bảng bị query mỗi lần Admin
/// mở trang nhật ký. Bảng to nhất hệ thống mà không có hạn dùng là một quả bom hẹn giờ,
/// nổ đúng lúc khó xử nhất (sau khi đã deploy, dữ liệu thật, không xoá bừa được).
///
/// VÌ SAO CHỈ XOÁ Security: Administrative là "ai nâng người này lên Admin", "ai khoá tài
/// khoản kia" — câu hỏi truy trách nhiệm không có hạn sử dụng, và số bản ghi rất ít nên
/// giữ mãi không tốn gì. Đây đúng là lý do AuditCategory được tách thành cột riêng ngay từ
/// đầu thay vì suy ra từ tiền tố của Action.
/// </summary>
public class AuditLogCleanupJob
{
    /// <summary>Log Security giữ 30 ngày — đủ để điều tra một sự cố vừa xảy ra.</summary>
    private const int RetentionDays = 30;

    /// <summary>
    /// Xoá theo LÔ, không xoá một phát. DELETE 500.000 dòng trong một transaction sẽ giữ
    /// lock bảng rất lâu và làm phình transaction log — mà 03:00 vẫn có thể có user đang
    /// thi (không phải ai cũng ngủ). Lô nhỏ = nhiều transaction ngắn, nhường chỗ cho
    /// nghiệp vụ chính giữa các lô.
    /// </summary>
    private const int BatchSize = 5_000;

    private readonly ApplicationDbContext _db;
    private readonly ILogger<AuditLogCleanupJob> _logger;

    public AuditLogCleanupJob(ApplicationDbContext db, ILogger<AuditLogCleanupJob> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task RunAsync()
    {
        var cutoff = DateTime.UtcNow.AddDays(-RetentionDays);
        var totalDeleted = 0;
        int deleted;

        do
        {
            // DELETE TOP (n) là T-SQL thuần, có chủ ý không dùng LINQ ExecuteDelete kèm
            // Take(): việc EF dịch được Take() trong ExecuteDelete hay không phụ thuộc
            // provider/phiên bản, mà đây là job chạy 03:00 KHÔNG AI NGỒI XEM — lỗi dịch
            // câu query ở đây là im lặng thất bại hàng đêm. Cách còn lại (lấy 5000 Id rồi
            // xoá theo Contains) thì vướng trần 2100 tham số của SQL Server.
            //
            // Dùng đúng index IX_AuditLogs_Category_CreatedAt: lọc theo cả hai cột.
            deleted = await _db.Database.ExecuteSqlInterpolatedAsync(
                $@"DELETE TOP ({BatchSize}) FROM AuditLogs
                   WHERE Category = {(int)AuditCategory.Security} AND CreatedAt < {cutoff}");

            totalDeleted += deleted;
        }
        // Lô cuối luôn nhỏ hơn BatchSize → thoát. Nếu đúng bằng thì còn dòng nữa, chạy tiếp.
        while (deleted == BatchSize);

        // Chỉ log khi CÓ xoá: job này chạy hàng ngày, ghi cả những đêm không có gì để xoá
        // thì log đầy dòng vô nghĩa và người đọc bỏ qua luôn cả dòng có ý nghĩa.
        if (totalDeleted > 0)
        {
            _logger.LogInformation(
                "Dọn nhật ký: xoá {Count} bản ghi Security cũ hơn {Days} ngày (trước {Cutoff:yyyy-MM-dd}).",
                totalDeleted, RetentionDays, cutoff);
        }
    }
}
