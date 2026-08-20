using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Auth;

public record GoogleLoginRequest(
    // ID token Google thực tế ~1-2KB. Đặt trần 4096 để chuỗi rác khổng lồ bị chặn ở
    // tầng DTO, không đi vào GoogleJsonWebSignature.ValidateAsync (parse + verify chữ
    // ký là việc tốn CPU, và nó còn gọi ra Google lấy public key).
    [Required(ErrorMessage = "Thiếu ID token của Google.")]
    [MaxLength(4096, ErrorMessage = "ID token không hợp lệ.")]
    string IdToken
);
