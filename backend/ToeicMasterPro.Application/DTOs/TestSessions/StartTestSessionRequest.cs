namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Body POST /api/test-session/start — User bắt đầu một lần thi.
///
/// Mục đích:
///   - Tạo bản ghi TestSession (Status = InProgress) gắn User + Test.
///   - Lưu Parts user chọn (full test hoặc chỉ Part 5,6,7...) để chấm đúng phạm vi.
/// </summary>
public record StartTestSessionRequest(
  Guid TestId,
  /// <summary>
  /// Part muốn làm: [1,2,5] hoặc null/empty = full đề.
  /// Khớp query ?parts= trên GET /api/test/{id}/play.
  /// </summary>
  int[]? Parts = null
);
