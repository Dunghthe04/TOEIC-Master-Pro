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
  int QuestionCount
);
