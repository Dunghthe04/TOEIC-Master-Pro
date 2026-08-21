using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

/// <summary>
/// Nhóm nhật ký — quyết định thời gian giữ log (AuditLogCleanupJob).
///
/// Tách thành cột riêng thay vì suy ra từ tiền tố của Action ("auth." vs "user."):
/// job dọn log phải lọc theo nhóm, mà lọc bằng LIKE 'auth.%' thì không dùng được index
/// và vỡ ngay khi có ai thêm một Action đặt tên khác quy ước.
/// </summary>
public enum AuditCategory
{
    /// <summary>
    /// Sự kiện bảo mật: đăng nhập ok/thất bại, đăng ký, đổi mật khẩu, token bị dùng lại.
    /// Sinh RẤT NHIỀU bản ghi (mỗi lần login một dòng) → xoá sau 30 ngày.
    /// </summary>
    Security = 1,

    /// <summary>
    /// Hành động quản trị: tạo/khoá/mở tài khoản, đổi vai.
    /// Ít bản ghi nhưng phải truy được trách nhiệm mãi mãi ("ai nâng người này lên
    /// Admin?") → KHÔNG xoá.
    /// </summary>
    Administrative = 2,
}

/// <summary>
/// Nhật ký hành động quản trị — ai làm gì, lúc nào, lên ai.
///
/// VÌ SAO CẦN BẢNG RIÊNG thay vì chỉ ILogger: log file chỉ mình đọc được qua terminal,
/// bị xoay vòng (rolling) và mất, và không truy vấn được ("ai đã khoá tài khoản này?").
/// Những thao tác như khoá tài khoản, đổi vai, xoá đề thi là loại việc PHẢI trả lời được
/// câu hỏi đó — nên phải nằm trong DB, hiện ra UI.
///
/// KHÔNG ghi FK sang ApplicationUser: log phải sống sót kể cả khi tài khoản liên quan bị
/// xoá. Nên lưu kèm Email/tên dưới dạng chữ (ảnh chụp tại thời điểm đó) — cũng đúng hơn
/// về mặt lịch sử: người đó lúc ấy tên gì thì log ghi tên đó, đổi tên sau không sửa lại
/// quá khứ.
/// </summary>
public class AuditLog : BaseEntity
{
    /// <summary>Nhóm log — quyết định có bị dọn định kỳ hay không.</summary>
    public AuditCategory Category { get; set; }

    /// <summary>
    /// Ai thực hiện. Null khi hệ thống tự làm (job nền), hoặc khi hành động do người
    /// CHƯA đăng nhập gây ra — đăng nhập thất bại là ví dụ chính: lúc đó chưa biết là ai.
    /// </summary>
    public Guid? ActorId { get; set; }

    /// <summary>Email người thực hiện, chụp tại thời điểm hành động.</summary>
    public string ActorEmail { get; set; } = string.Empty;

    /// <summary>
    /// Loại hành động, dạng chuỗi ngắn ổn định. Giá trị dùng thật xem AuditActions.
    ///
    /// Dùng chuỗi chứ không enum: thêm loại hành động mới không cần migration, và log cũ
    /// không bao giờ bị đổi nghĩa vì ai đó chèn một giá trị vào giữa enum.
    /// </summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Đối tượng bị tác động — "User", "Test", "Question"…</summary>
    public string TargetType { get; set; } = string.Empty;

    public Guid? TargetId { get; set; }

    /// <summary>Nhãn dễ đọc của đối tượng (email, tên đề thi) tại thời điểm đó.</summary>
    public string TargetLabel { get; set; } = string.Empty;

    /// <summary>Chi tiết thêm, dạng chữ đã dựng sẵn để hiện thẳng lên UI.</summary>
    public string? Detail { get; set; }

    /// <summary>
    /// IP người thực hiện — cần khi điều tra "tài khoản admin này có bị chiếm không".
    /// Chuỗi vì có thể là IPv6.
    /// </summary>
    public string? IpAddress { get; set; }
}
