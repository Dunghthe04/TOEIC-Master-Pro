using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Auth;

public record ForgotPasswordRequest(
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [MaxLength(256, ErrorMessage = "Email quá dài.")]
    string Email
);
