using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

/// <summary>
/// Một lượt luyện tập — ghi lại HỆ THỐNG ĐÃ PHÁT NHỮNG CÂU NÀO CHO AI.
///
/// VÌ SAO CẦN: trước đây POST /api/practice/submit chấm bất kỳ questionId nào miễn
/// là IsPublished, và trả về CorrectOptionId + CorrectLabel + Explanation vô điều
/// kiện. Người đang thi thật chỉ cần lấy questionId từ màn hình, gửi sang đây kèm
/// selectedOptionId = null, là nhận thẳng đáp án đúng — một request, không cần đoán,
/// nhét được cả 200 câu vào một lần gọi. Đây là OWASP API1:2023 Broken Object Level
/// Authorization: hệ thống biết bạn LÀ AI (có [Authorize]) nhưng không kiểm bạn CÓ
/// QUYỀN với dữ liệu này không.
///
/// Có phiên rồi thì Submit chỉ chấm câu THUỘC phiên đó.
/// </summary>
public class PracticeSession : BaseEntity
{
    public Guid UserId { get; set; }

    /// <summary>
    /// Các QuestionId đã phát, nối bằng dấu phẩy — cùng quy ước với
    /// TestSession.PartsFilter ("1,2,5").
    ///
    /// VÌ SAO KHÔNG TÁCH BẢNG CON: luyện tập là MỘT LƯỢT — phát câu, làm, nộp một
    /// lần, không lưu đáp án tạm như thi thử. Tập id này chỉ cần đọc nguyên khối
    /// đúng một lần lúc chấm, không bao giờ truy vấn từng dòng. Bảng con sẽ tạo
    /// 10–50 dòng mỗi lượt cho dữ liệu không ai join tới.
    ///
    /// ĐÁNH ĐỔI: không thống kê được "câu X được luyện bao nhiêu lần" bằng SQL.
    /// Khi nào cần thống kê đó thì mới tách bảng con.
    /// </summary>
    public string QuestionIds { get; set; } = string.Empty;

    /// <summary>null = chưa nộp. Có giá trị = đã chấm, không cho nộp lại.</summary>
    public DateTime? SubmittedAt { get; set; }

    public int? CorrectCount { get; set; }
    public int? TotalCount { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
