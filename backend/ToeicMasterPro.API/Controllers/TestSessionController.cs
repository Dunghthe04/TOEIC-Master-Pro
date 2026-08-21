using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.API.Extensions;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.TestSessions;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// API phiên thi (Day 28) — User đã login mới gọi được.
///
/// Luồng FE:
///   1. POST /start           → nhận sessionId
///   2. PATCH /{id}/answers   → lưu đáp án tạm (mỗi lần chọn hoặc debounce)
///   3. POST /{id}/submit     → nộp bài, nhận điểm + review
/// </summary>
[ApiController]
[Route("api/test-session")]
// CHỈ User thi. CM soạn nội dung, Admin quản account — không vai nào cần thi.
// Chặn ở SERVER, không chỉ ẩn menu: gõ /mock-test vào URL cũng phải 403.
[Authorize(Roles = "User")] // lấy userId từ JWT
public class TestSessionController : ControllerBase
{
    private readonly ITestSessionService _service;
    private readonly ICurrentUserService _currentUser;

    public TestSessionController(ITestSessionService service, ICurrentUserService currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Bắt đầu phiên thi mới.
    ///
    /// Body: { testId, parts?: [1,2,5] } — parts bỏ trống = full đề.
    /// Trả sessionId — FE giữ để SaveAnswers / Submit.
    /// </summary>
    [HttpPost("start")]
    public async Task<IActionResult> Start([FromBody] StartTestSessionRequest req)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.StartAsync(userId.Value, req);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }


    /// <summary>
    /// Đánh dấu bắt đầu phần Reading — FE gọi khi chuyển sang màn Reading directions.
    ///
    /// Idempotent: gọi lại (vd sau F5) KHÔNG đặt lại mốc, chỉ trả về số giây còn lại.
    /// Nhờ vậy đồng hồ tiếp tục từ chỗ dở thay vì quay về 75:00.
    /// </summary>
    [HttpPost("{id:Guid}/reading-start")]
    public async Task<IActionResult> ReadingStart(Guid id)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.MarkReadingStartedAsync(userId.Value, id);
        return result.ToActionResult(this, new { readingSecondsLeft = result.Value });
    }
    /// <summary>
    /// Lưu / cập nhật đáp án tạm (chưa chấm điểm).
    ///
    /// Upsert theo questionId trong session — xem TestSessionService.SaveAnswersAsync.
    /// Chỉ session Status = InProgress mới ghi được.
    /// </summary>
    [HttpPatch("{id:Guid}/answers")]
    public async Task<IActionResult> SaveAnswers(Guid id, [FromBody] SaveSessionAnswersRequest req)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.SaveAnswersAsync(userId.Value, id, req);
        return result.ToActionResult(this, new { saved = result.Value });
    }

    /// <summary>
    /// Nộp bài — chấm điểm, đổi Status → Completed.
    ///
    /// Trả ListeningScore, ReadingScore, TotalScore và review từng câu.
    /// </summary>
    [HttpPost("{id:Guid}/submit")]
    public async Task<IActionResult> Submit(Guid id)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.SubmitAsync(userId.Value, id);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Lịch sử thi đã nộp của user đang login (Day 31).
    ///
    /// Cùng đề thi nhiều lần → nhiều dòng (mới nhất trước).
    /// Query testId = chỉ lịch sử 1 đề (màn chi tiết đề đó).
    /// Biểu đồ best score / đề → GET /stats/by-test.
    /// </summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory(
        [FromQuery] Guid? testId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetHistoryAsync(userId.Value, testId, page, pageSize);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Tổng quan thống kê thi — card dashboard (Day 32 Bước 1).
    ///
    /// Trả: số lần thi, điểm best/latest/avg, mục tiêu, id phiên để link xem lại.
    /// fullOnly=true (mặc định): chỉ full test — đồng bộ với /stats/by-test.
    /// </summary>
    [HttpGet("stats/overview")]
    public async Task<IActionResult> GetStatsOverview([FromQuery] bool fullOnly = true)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetStatsOverviewAsync(userId.Value, fullOnly);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Điểm theo thời gian — line chart dashboard (Day 32 Bước 2).
    ///
    /// Mỗi lần thi = 1 điểm; sắp xếp cũ → mới. Trả targetScore để vẽ đường mục tiêu.
    /// fullOnly=true (mặc định): chỉ full test.
    /// </summary>
    [HttpGet("stats/timeline")]
    public async Task<IActionResult> GetStatsTimeline([FromQuery] bool fullOnly = true)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetStatsTimelineAsync(userId.Value, fullOnly);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Gom % đúng Part 1–7 từ nhiều lần thi — phân tích Part yếu dashboard (Day 32 Bước 3).
    ///
    /// Tính lại từ TestSessionAnswers (partBreakdown không lưu DB).
    /// fullOnly=true (mặc định): chỉ full test.
    /// </summary>
    [HttpGet("stats/parts")]
    public async Task<IActionResult> GetStatsParts([FromQuery] bool fullOnly = true)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetStatsPartsAsync(userId.Value, fullOnly);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Best score theo từng đề — biểu đồ cột + so với TargetScore (Day 31 Bước 3).
    ///
    /// fullOnly=true (mặc định): chỉ full test — tránh so sánh partial với 990.
    /// </summary>
    [HttpGet("stats/by-test")]
    public async Task<IActionResult> GetScoreStatsByTest([FromQuery] bool fullOnly = true)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetScoreStatsByTestAsync(userId.Value, fullOnly);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Xem lại 1 lần thi đã nộp — điểm, phân tích Part, review từng câu (Day 31 Bước 2).
    /// Dùng khi user bấm 1 dòng trong lịch sử.
    /// </summary>
    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetDetailAsync(userId.Value, id);
        // ToActionResult map ErrorType → HTTP status (404/403/409/400) thay vì 400 cho
        // mọi lỗi. Xem ResultExtensions + Result.ErrorType.
        return result.ToActionResult(this);
    }

    /// <summary>Lấy UserId từ JWT — null nếu token không hợp lệ.</summary>
    private Guid? RequireUserId() => _currentUser.UserId;

    /// <summary>
    /// Bài đang làm dở của đề này — 204 nếu không có.
    /// Màn cấu trúc đề gọi để hỏi "tiếp tục hay làm lại" trước khi user bấm bắt đầu.
    /// </summary>
    [HttpGet("active")]
    public async Task<IActionResult> GetActive([FromQuery] Guid testId)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetActiveAsync(userId.Value, testId);
        // Không dùng ToActionResult ở đây: thành công mà Value null phải trả 204 NoContent
        // (FE phân biệt "có bài dở" với "không có"), không phải 200 kèm null.
        if (!result.IsSuccess) return result.ToActionResult(this);
        return result.Value is null ? NoContent() : Ok(result.Value);
    }

    /// <summary>Bỏ hẳn phiên đang dở — nút "Làm lại từ đầu".</summary>
    [HttpPost("{id:Guid}/abandon")]
    public async Task<IActionResult> Abandon(Guid id)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.AbandonAsync(userId.Value, id);
        return result.ToActionResult(this, "Đã bỏ phiên thi.");
    }
}
