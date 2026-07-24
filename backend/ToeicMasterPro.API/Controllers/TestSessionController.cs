using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
[Authorize] // chỉ User đã đăng nhập — lấy userId từ JWT
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
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
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
        return result.IsSuccess
            ? Ok(new { saved = result.Value })
            : BadRequest(new { error = result.Error });
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
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    /// <summary>Lấy UserId từ JWT — null nếu token không hợp lệ.</summary>
    private Guid? RequireUserId() => _currentUser.UserId;
}
