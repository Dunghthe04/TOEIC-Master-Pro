namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Một đáp án user chọn trong phiên thi.
/// SelectedOptionId = null → user bỏ qua / chưa chọn.
/// </summary>
public record SessionAnswerItem(
  Guid QuestionId,
  Guid? SelectedOptionId
);

/// <summary>
/// Body PATCH /api/test-session/{id}/answers — lưu / cập nhật đáp án tạm.
///
/// Mục đích:
///   - User làm bài → FE gửi batch đáp án (debounce hoặc mỗi lần chọn).
///   - Chỉ session InProgress của chính user mới được ghi.
///   - Chưa chấm điểm — chỉ lưu SelectedOptionId.
/// </summary>
public record SaveSessionAnswersRequest(
  List<SessionAnswerItem> Answers
);
