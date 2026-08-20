using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Auth;

// Email + Token KHÔNG do người dùng gõ — chúng đọc từ query string của link trong mail
// (AuthService.ForgotPasswordAsync dựng link). Nhưng vẫn phải validate: endpoint là
// công khai, ai cũng POST thẳng vào được, không chỉ người bấm link.
public record ResetPasswordRequest(
    [Required(ErrorMessage = "Thiếu email trong link đặt lại mật khẩu.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [MaxLength(256, ErrorMessage = "Email quá dài.")]
    string Email,

    // Không đặt MaxLength cụ thể: độ dài token Identity phụ thuộc token provider và
    // có thể đổi khi cấu hình đổi — đặt cứng là tự tạo lỗi khó hiểu về sau.
    [Required(ErrorMessage = "Thiếu token trong link đặt lại mật khẩu.")]
    string Token,

    // Luật mật khẩu (chữ hoa/số/ký tự đặc biệt) để Identity kiểm — xem ResetPasswordAsync,
    // nó phân loại lỗi Password* để hiện thật còn lỗi token thì che.
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới.")]
    [MaxLength(128, ErrorMessage = "Mật khẩu quá dài.")]
    string NewPassword
);
