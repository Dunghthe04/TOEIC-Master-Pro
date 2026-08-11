namespace ToeicMasterPro.Application.DTOs.Practice;

/// <summary>
/// GET /api/practice/questions — câu hỏi kèm SessionId để nộp bài.
///
/// SessionId là null khi không có câu nào khớp bộ lọc: không có gì để phát thì
/// không tạo phiên. Dùng null thay vì Guid.Empty để phía client buộc phải xử lý
/// trường hợp đó, thay vì lỡ gửi một guid rỗng lên rồi nhận lỗi khó hiểu.
/// </summary>
public record PracticeStartResponse(
    Guid? SessionId,
    IReadOnlyList<PracticeQuestionResponse> Questions
);
