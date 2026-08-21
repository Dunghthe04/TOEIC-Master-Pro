using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Admin;

/// <summary>Một dòng trong bảng quản lý tài khoản.</summary>
public record AdminUserListItem(
    Guid Id,
    string Email,
    string FullName,
    string? AvatarUrl,
    IReadOnlyList<string> Roles,
    bool EmailConfirmed,
    /// <summary>true = đang bị khoá (LockoutEnd còn ở tương lai).</summary>
    bool IsLockedOut,
    DateTime? LockoutEnd,
    int AccessFailedCount,
    string Plan,
    int TargetScore,
    int XpPoints,
    int StreakDays,
    DateTime CreatedAt,
    /// <summary>Số lượt thi ĐÃ NỘP — dùng để cảnh báo trước khi thao tác.</summary>
    int CompletedSessions,
    int? BestScore
);

/// <summary>Kết quả phân trang — FE cần Total để vẽ số trang.</summary>
public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Total,
    int Page,
    int PageSize
);

/// <summary>
/// Đặt lại TOÀN BỘ role của một tài khoản (thay thế, không phải thêm dồn).
///
/// Gửi cả danh sách thay vì add/remove từng cái: hai request add/remove rời rạc có thể
/// chen nhau và để tài khoản ở trạng thái nửa vời (VD mất hết role, không vào được đâu).
/// </summary>
public record UpdateUserRolesRequest(
    [Required(ErrorMessage = "Vui lòng chọn ít nhất một vai.")]
    [MinLength(1, ErrorMessage = "Tài khoản phải có ít nhất một vai.")]
    IReadOnlyList<string> Roles
);

/// <summary>
/// Admin tự tạo tài khoản — dùng để lập tài khoản ContentManager cho nhân sự mới
/// (không thể để họ tự đăng ký rồi chờ Admin nâng vai: luồng đăng ký công khai chỉ
/// gán role "User").
///
/// KHÔNG nhận mật khẩu: tài khoản tạo ra không có mật khẩu, hệ thống gửi mail đặt lại
/// để chính người đó tự đặt. Cùng lý do với việc Admin không được xem/đặt mật khẩu ai —
/// Admin không bao giờ biết mật khẩu của người khác thì không mạo danh được.
/// EmailConfirmed đặt sẵn = true: chính Admin đã xác nhận địa chỉ này là của nhân sự,
/// không cần bắt họ bấm thêm link xác thực.
/// </summary>
public record CreateUserRequest(
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [MaxLength(256, ErrorMessage = "Email quá dài.")]
    string Email,

    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [MaxLength(100, ErrorMessage = "Họ tên tối đa 100 ký tự.")]
    string FullName,

    [Required(ErrorMessage = "Vui lòng chọn vai.")]
    [MinLength(1, ErrorMessage = "Tài khoản phải có ít nhất một vai.")]
    IReadOnlyList<string> Roles
);

/// <summary>
/// Khoá / mở tài khoản.
///
/// Days = null nghĩa là khoá VÔ THỜI HẠN (dùng DateTimeOffset.MaxValue). Có giá trị thì
/// khoá tạm N ngày — hữu ích khi chỉ muốn "hạ nhiệt" chứ không cấm hẳn.
/// </summary>
public record LockUserRequest(
    bool Lock,
    [Range(1, 3650, ErrorMessage = "Số ngày khoá phải từ 1 đến 3650.")]
    int? Days
);
