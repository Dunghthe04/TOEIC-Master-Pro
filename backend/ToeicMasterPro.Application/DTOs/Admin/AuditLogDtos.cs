namespace ToeicMasterPro.Application.DTOs.Admin;

/// <summary>
/// Một dòng trong trang nhật ký.
///
/// Trả Category dưới dạng CHUỖI ("Security"/"Administrative") thay vì số: FE hiện tên tab
/// và badge theo nó, còn số thì mọi chỗ đọc log phải giữ một bảng tra song song với enum
/// ở backend — hai nguồn sự thật cho cùng một khái niệm.
///
/// ActorId/TargetId trả kèm để FE dựng được lối tắt sang trang chi tiết tài khoản. Có thể
/// null: ActorId null khi hành động do người CHƯA đăng nhập gây ra (đăng nhập thất bại là
/// ca chính), TargetId null khi đối tượng đã bị xoá hoặc không có id.
/// </summary>
public record AuditLogListItem(
    Guid Id,
    DateTime CreatedAt,
    string Category,
    string Action,
    Guid? ActorId,
    string ActorEmail,
    string TargetType,
    Guid? TargetId,
    string TargetLabel,
    string? Detail,
    string? IpAddress
);
