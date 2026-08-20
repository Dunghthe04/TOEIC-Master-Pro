using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Auth;

// NGUYÊN TẮC PHÂN VAI giữa DTO và Identity — để không có hai nguồn sự thật:
//   · DTO kiểm HÌNH DẠNG và KÍCH THƯỚC (có mặt chưa, đúng dạng email chưa, dài quá chưa)
//   · Identity kiểm CHÍNH SÁCH (đủ chữ hoa/số/ký tự đặc biệt, độ dài tối thiểu)
// Nên ở đây KHÔNG lặp lại luật mật khẩu của Program.cs: lặp là hai chỗ sẽ lệch nhau
// lúc nào đó, mà Identity vẫn là chỗ chặn thật.
//
// [Required] KHÔNG dư dù <Nullable>enable</Nullable> đã coi string non-nullable là
// required ngầm: cái ngầm đó sinh thông báo tiếng Anh ("The Email field is required."),
// khai báo tường minh mới đặt được thông báo tiếng Việt.
public record RegisterRequest(
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không hợp lệ.")]
    [MaxLength(256, ErrorMessage = "Email quá dài.")]
    string Email,

    // MaxLength ở đây là biện pháp BẢO MẬT, không phải dọn dẹp: Identity băm mật khẩu
    // bằng PBKDF2 trên toàn bộ input, nên POST mật khẩu 10MB là bắt CPU server băm 10MB
    // — một request rẻ tiền đổi lấy tải nặng phía server (CPU DoS).
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [MaxLength(128, ErrorMessage = "Mật khẩu quá dài.")]
    string Password,

    // Khớp UserConfiguration.HasMaxLength(100). Không có dòng này thì tên 101 ký tự
    // xuống tới SQL Server mới vỡ ("String or binary data would be truncated") → 500.
    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [MaxLength(100, ErrorMessage = "Họ tên tối đa 100 ký tự.")]
    string FullName
);
