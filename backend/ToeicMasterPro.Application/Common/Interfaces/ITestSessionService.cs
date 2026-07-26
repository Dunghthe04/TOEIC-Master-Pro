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

  /// <summary>
  /// Lịch sử các lần thi đã nộp của user (Day 31).
  /// Cùng đề nhiều lần → nhiều dòng. Biểu đồ best score gom ở API stats (bước sau).
  /// </summary>
  Task<Result<TestSessionHistoryResponse>> GetHistoryAsync(
      Guid userId,
      Guid? testId = null,
      int page = 1,
      int pageSize = 20);

  /// <summary>
  /// Xem lại 1 phiên đã nộp — điểm + part breakdown + review (Day 31 Bước 2).
  /// </summary>
  Task<Result<TestSessionDetailResponse>> GetDetailAsync(Guid userId, Guid sessionId);

  /// <summary>
  /// Best score theo từng đề — phục vụ biểu đồ cột (Day 31 Bước 3).
  /// Mặc định chỉ tính full test (PartsFilter null).
  /// </summary>
  Task<Result<TestScoreStatsResponse>> GetScoreStatsByTestAsync(Guid userId, bool fullOnly = true);

  /// <summary>
  /// Dữ liệu tổng hợp cho Dashboard (Day 32) — xu hướng điểm + độ chính xác theo Part.
  /// </summary>
  /// <param name="recentLimit">Số lần thi gần nhất vẽ lên biểu đồ đường (kẹp trong 3–30).</param>
  Task<Result<DashboardSummaryResponse>> GetDashboardAsync(Guid userId, int recentLimit = 10);
}
