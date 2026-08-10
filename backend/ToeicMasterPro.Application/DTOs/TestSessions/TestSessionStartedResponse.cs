using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response sau khi start session thành công.
///
/// Frontend dùng SessionId để:
///   - PATCH đáp án định kỳ (thay localStorage Day 27)
///   - POST submit khi nộp bài
/// </summary>
public record TestSessionStartedResponse(
  Guid SessionId,
  Guid TestId,
  string TestTitle,
  TestSessionStatus Status,
  DateTime StartedAt,
  /// <summary>Part user chọn lúc bắt đầu — null = full.</summary>
  int[]? PartsFilter,
  int QuestionCount,

  /// <summary>
  /// true = đây là phiên ĐANG LÀM DỞ được trả lại, không phải phiên mới.
  /// Frontend dùng để hiện toast "đã khôi phục bài thi" thay vì im lặng.
  /// </summary>
  bool Resumed,

  /// <summary>
  /// Đáp án đã lưu của phiên. Rỗng nếu là phiên mới.
  /// Dùng lại SessionAnswerItem của SaveSessionAnswersRequest — cùng hình dạng,
  /// và frontend đã có sẵn kiểu tương ứng nên không phải khai báo thêm.
  /// </summary>
  IReadOnlyList<SessionAnswerItem> Answers,
  /// <summary>Mốc bắt đầu Reading — null = chưa vào Reading.</summary>
  DateTime? ReadingStartedAt,

  /// <summary>
  /// Giây Reading còn lại do SERVER tính. Frontend chỉ hiển thị và đếm lùi
  /// từ con số này, không tự khởi tạo 75 phút nữa.
  /// </summary>
  int? ReadingSecondsLeft
);
