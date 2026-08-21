using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Application.Common.Interfaces;

/// <summary>
/// Ghi nhật ký hành động vào DB.
///
/// MỘT CHỖ GHI DUY NHẤT: chỗ gọi chỉ cần nói "việc gì, lên ai", còn ai đang thực hiện và
/// từ IP nào thì service tự lấy từ HttpContext. Nếu để từng chỗ gọi tự truyền actor/IP thì
/// sẽ có chỗ quên, và log thiếu actor là log vô dụng.
///
/// ⚠️ MỌI hàm ở đây KHÔNG BAO GIỜ ném exception. Ghi log là việc phụ — DB timeout lúc ghi
/// log không được làm đăng nhập thất bại hay khoá tài khoản không thành. Lỗi được bắt và
/// đưa vào ILogger, rồi bỏ qua.
///
/// Implementation ghi bằng DbContext RIÊNG, không dùng chung với chỗ gọi — try/catch một
/// mình không đủ để cách ly, vì entity lỗi kẹt trong ChangeTracker sẽ lây sang mọi
/// SaveChanges sau đó của nghiệp vụ chính. Xem AuditLogger để biết chi tiết.
/// </summary>
public interface IAuditLogger
{
    /// <summary>
    /// Ghi một dòng log. Actor lấy từ người đang đăng nhập (null nếu chưa đăng nhập —
    /// đăng nhập thất bại là ví dụ chính: lúc đó chưa biết là ai).
    /// </summary>
    /// <param name="category">Quyết định log có bị dọn định kỳ hay không.</param>
    /// <param name="action">Hằng số trong AuditActions.</param>
    /// <param name="targetType">"User", "Test"…</param>
    /// <param name="targetId">Id đối tượng bị tác động, null nếu không có.</param>
    /// <param name="targetLabel">Nhãn dễ đọc (email, tên đề) tại thời điểm đó.</param>
    /// <param name="detail">Chi tiết đã dựng sẵn để hiện thẳng lên UI.</param>
    /// <param name="actorEmailOverride">
    /// Chỉ dùng khi người thực hiện CHƯA đăng nhập nên HttpContext không biết họ là ai —
    /// điển hình là đăng nhập thất bại: cần ghi lại email đã gõ để biết ai đang bị dò.
    /// </param>
    Task LogAsync(
        AuditCategory category,
        string action,
        string targetType,
        Guid? targetId,
        string targetLabel,
        string? detail = null,
        string? actorEmailOverride = null,
        CancellationToken ct = default);
}
