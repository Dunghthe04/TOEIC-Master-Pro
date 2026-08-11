/// <summary>
/// GET /api/test-session/active?testId= — bài đang làm dở của đề này (nếu có).
///
/// Chỉ ĐỌC, không tạo/sửa phiên. Dùng cho màn cấu trúc đề để hỏi user
/// "tiếp tục hay làm lại", trước khi họ bấm bắt đầu.
/// </summary>
public record ActiveTestSessionResponse(
  Guid SessionId,
  Guid TestId,
  string TestTitle,
  DateTime StartedAt,
  /// <summary>Phạm vi của BÀI CŨ — null = full đề. Nút "Tiếp tục" phải dùng
  /// giá trị này, KHÔNG dùng ô Part đang tick trên màn hình.</summary>
  int[]? PartsFilter,
  int AnsweredCount,
  int QuestionCount,
  int? ReadingSecondsLeft
);