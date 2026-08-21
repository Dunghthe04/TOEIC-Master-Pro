using System.ComponentModel.DataAnnotations;

namespace ToeicMasterPro.Application.DTOs.Profile;

// Trước đây record này KHÔNG có một attribute validate nào, mà ProfileService thì gán
// thẳng `user.TargetScore = req.TargetScore` — nghĩa là POST targetScore = -500 hoặc
// 99999 đều lưu được. Hậu quả không chỉ là dữ liệu bẩn: dashboard vẽ đường "mục tiêu"
// theo giá trị này (TestSessionService.GetStatsTimeline/ByTest), nên một số vô nghĩa
// làm méo toàn bộ biểu đồ tiến độ.
public record UpdateProfileRequest(
    // Khớp UserConfiguration.HasMaxLength(100) — không có thì tên 101 ký tự xuống tới
    // SQL Server mới vỡ ("String or binary data would be truncated") → 500.
    [Required(ErrorMessage = "Vui lòng nhập họ tên.")]
    [MaxLength(100, ErrorMessage = "Họ tên tối đa 100 ký tự.")]
    string FullName,

    // Thang điểm TOEIC Listening & Reading: 10–990, và luôn là bội số của 5
    // (Listening 5–495 + Reading 5–495). Range chặn khoảng, còn bội số 5 phải tự kiểm
    // ở IValidatableObject bên dưới — DataAnnotations không có attribute sẵn cho việc đó.
    [Range(10, 990, ErrorMessage = "Điểm mục tiêu phải từ 10 đến 990.")]
    int TargetScore,

    // Cho phép null = chưa định ngày thi. Ngày trong QUÁ KHỨ thì chặn: mục tiêu là việc
    // của tương lai, và ExamReminderService chỉ gửi nhắc cho kỳ thi phía trước nên ngày
    // cũ vừa vô nghĩa vừa gây nhầm "sao không thấy mail nhắc".
    DateTime? ExamDate
) : IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (TargetScore % 5 != 0)
            yield return new ValidationResult(
                "Điểm TOEIC luôn là bội số của 5.", [nameof(TargetScore)]);

        // So theo NGÀY, không theo giờ: chọn đúng hôm nay phải hợp lệ (người ta đặt mục
        // tiêu cho kỳ thi chiều nay được), chỉ chặn từ hôm qua trở về trước.
        // DateTime.UtcNow.AddHours(7) = giờ VN, cùng quy ước với ExamReminderService.
        if (ExamDate is not null && ExamDate.Value.Date < DateTime.UtcNow.AddHours(7).Date)
            yield return new ValidationResult(
                "Ngày dự thi không được ở trong quá khứ.", [nameof(ExamDate)]);
    }
}
