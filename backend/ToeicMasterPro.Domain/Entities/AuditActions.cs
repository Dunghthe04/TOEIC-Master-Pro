namespace ToeicMasterPro.Domain.Entities;

/// <summary>
/// Danh mục giá trị cho AuditLog.Action.
///
/// VÌ SAO LÀ HẰNG SỐ chứ không enum: cột trong DB là chuỗi (thêm loại mới không cần
/// migration, log cũ không đổi nghĩa khi ai chèn giá trị vào giữa enum). Nhưng gõ chuỗi
/// tay ở từng chỗ gọi thì sớm muộn có "auth.login.fail" lẫn với "auth.login.failed" —
/// hai giá trị cho cùng một việc, và bộ lọc trên UI mất một nửa dữ liệu.
///
/// Quy ước tên: "&lt;nhóm&gt;.&lt;đối tượng&gt;.&lt;việc&gt;", chữ thường, không dấu.
/// </summary>
public static class AuditActions
{
    // ── Bảo mật (AuditCategory.Security) ────────────────────────────────
    public const string Register = "auth.register";
    public const string LoginSucceeded = "auth.login.succeeded";
    public const string LoginFailed = "auth.login.failed";

    /// <summary>Bị Identity khoá tạm vì sai mật khẩu quá ngưỡng.</summary>
    public const string LoginLockedOut = "auth.login.lockedout";

    /// <summary>Đăng nhập bị chặn vì chưa xác thực email.</summary>
    public const string LoginNotConfirmed = "auth.login.not_confirmed";

    public const string LoginGoogle = "auth.login.google";
    public const string PasswordResetRequested = "auth.password.reset_requested";
    public const string PasswordResetCompleted = "auth.password.reset_completed";
    public const string EmailConfirmed = "auth.email.confirmed";

    /// <summary>
    /// Refresh token đã revoke bị mang ra dùng lại — dấu hiệu token bị đánh cắp.
    /// AuthService đã phát hiện việc này từ trước và thu hồi toàn bộ token của user,
    /// nhưng chỉ ghi vào log file nên không ai đọc được.
    /// </summary>
    public const string RefreshTokenReused = "auth.token.reused";

    // ── Quản trị (AuditCategory.Administrative) ─────────────────────────
    public const string UserCreated = "admin.user.created";
    public const string UserRolesUpdated = "admin.user.roles_updated";
    public const string UserLocked = "admin.user.locked";
    public const string UserUnlocked = "admin.user.unlocked";
    public const string UserPasswordResetSent = "admin.user.password_reset_sent";
    public const string UserEmailConfirmed = "admin.user.email_confirmed";
}
