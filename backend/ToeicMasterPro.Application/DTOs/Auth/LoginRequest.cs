using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Auth;

public record LoginRequest(
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [MaxLength(256, ErrorMessage = "Email quá dài.")]
    string Email,

    // CỐ Ý chỉ [Required] + [MaxLength], KHÔNG kiểm luật mật khẩu ở đây.
    // Đăng nhập mà từ chối vì "mật khẩu chưa đủ chữ hoa" là vô nghĩa (mật khẩu đã đặt
    // rồi, giờ chỉ đối chiếu), và còn tiết lộ chính sách mật khẩu cho người chưa có
    // tài khoản. MaxLength giữ lại vì lý do CPU DoS như RegisterRequest.
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [MaxLength(128, ErrorMessage = "Mật khẩu quá dài.")]
    string Password
);
