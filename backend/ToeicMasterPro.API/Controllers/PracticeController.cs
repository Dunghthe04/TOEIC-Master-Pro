using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Practice;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] // → /api/practice
[Authorize(Roles = "User")] // chỉ học viên luyện — CM soạn nội dung, Admin quản account
public class PracticeController : ControllerBase
{
    private readonly IPracticeService _service;
    private readonly ICurrentUserService _currentUser;

    public PracticeController(IPracticeService service, ICurrentUserService currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    private Guid? RequireUserId() => _currentUser.UserId;

    /// <summary>
    /// Lấy câu luyện tập + tạo phiên.
    ///
    /// Trả về { sessionId, questions }. sessionId phải gửi lại khi nộp — nó là thứ
    /// chứng minh những câu này đã thật sự được phát cho chính user đang gọi.
    /// sessionId = null khi không có câu nào khớp bộ lọc.
    /// </summary>
    // GET /api/practice/questions?part=5&difficulty=Easy&tag=Grammar&limit=10
    [HttpGet("questions")]
    public async Task<IActionResult> GetQuestions(
        [FromQuery] QuestionPart? part,
        [FromQuery] DifficultyLevel? difficulty,
        [FromQuery] string? tag,
        [FromQuery] int limit = 10)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetQuestionsAsync(userId.Value, part, difficulty, tag, limit);
        return Ok(result);
    }

    /// <summary>
    /// Nộp bài luyện — chỉ chấm câu THUỘC phiên trong body.
    ///
    /// userId lấy từ JWT, KHÔNG nhận từ client: nếu để client tự khai thì kiểm quyền
    /// sở hữu thành vô nghĩa, ai cũng khai được id người khác. Trước đây service
    /// không hề nhận userId nên về mặt kiểu dữ liệu nó không thể kiểm gì cả.
    /// </summary>
    // POST /api/practice/submit
    [HttpPost("submit")]
    public async Task<IActionResult> Submit(SubmitPracticeRequest req)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.SubmitAsync(userId.Value, req);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}
