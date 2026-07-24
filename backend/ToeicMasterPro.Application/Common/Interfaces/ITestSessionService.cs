using ToeicMasterPro.Application.DTOs.TestSessions;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

/// <summary>
/// Service quản lý phiên thi (Day 28).
///
/// Luồng nghiệp vụ:
///   1. StartAsync      — User bấm "Bắt đầu" → tạo TestSession InProgress
///   2. SaveAnswersAsync — Lưu đáp án tạm (Listening + Reading)
///   3. SubmitAsync     — Nộp bài → chấm điểm → Completed
///
/// Entity đã có sẵn (Day 2): TestSession, TestSessionAnswer.
/// Bước 2 Day 28 sẽ implement class TestSessionService.
/// </summary>
public interface ITestSessionService
{
  /// <summary>
  /// Bắt đầu phiên thi mới.
  /// Kiểm tra: đề published, user đăng nhập, không có session InProgress trùng đề (tùy rule).
  /// </summary>
  Task<Result<TestSessionStartedResponse>> StartAsync(Guid userId, StartTestSessionRequest req);

  /// <summary>
  /// Lưu / cập nhật đáp án tạm (upsert theo QuestionId trong session).
  /// Chỉ khi Status = InProgress và session thuộc userId.
  /// </summary>
  Task<Result<int>> SaveAnswersAsync(Guid userId, Guid sessionId, SaveSessionAnswersRequest req);

  /// <summary>
  /// Nộp bài: chấm điểm, ghi điểm vào TestSession, Status → Completed.
  /// </summary>
  Task<Result<TestSessionSubmitResponse>> SubmitAsync(Guid userId, Guid sessionId);
}
