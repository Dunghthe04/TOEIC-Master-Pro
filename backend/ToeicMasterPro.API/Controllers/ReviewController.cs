using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.API.Extensions;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Review;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Sổ tay lỗi sai — câu người học từng làm sai và chưa gỡ.
///
/// Thay cho <c>/api/practice</c> cũ. Trang cũ bắt người dùng tự chọn Part, độ khó, số câu
/// rồi mới có gì để làm — và sau nhiều tháng có ĐÚNG 0 phiên. Ở đây không có lựa chọn nào
/// cần đưa ra: mở là đã có sẵn danh sách câu của chính mình.
/// </summary>
[ApiController]
[Route("api/review")]
[Authorize(Roles = "User")]
public class ReviewController : ControllerBase
{
    private readonly IReviewNotebookService _service;
    private readonly ICurrentUserService _currentUser;

    public ReviewController(IReviewNotebookService service, ICurrentUserService currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    /// <summary>Danh sách câu chưa gỡ, kèm số đếm theo Part và theo đề để dựng thanh lọc.</summary>
    /// <param name="part">Lọc theo Part 1–7. Bỏ trống = tất cả.</param>
    /// <param name="testId">Lọc theo một đề. Bỏ trống = mọi đề.</param>
    [HttpGet("questions")]
    public async Task<IActionResult> GetQuestions(
        [FromQuery] int? part, [FromQuery] Guid? testId,
        [FromQuery] int skip = 0, [FromQuery] int take = 20)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetAsync(userId.Value, part, testId, skip, take);
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Trả lời một câu trong chế độ luyện lại.
    ///
    /// Đúng đủ số lần liên tiếp thì câu tự rời sổ tay; sai thì quay về đầu.
    /// </summary>
    [HttpPost("questions/{questionId:Guid}/answer")]
    public async Task<IActionResult> Answer(Guid questionId, [FromBody] AnswerReviewRequest req)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.AnswerAsync(userId.Value, questionId, req.SelectedOptionId);
        return result.ToActionResult(this);
    }

    /// <summary>Tự đánh dấu "Đã hiểu" — gỡ ngay, không cần đúng đủ số lần.</summary>
    [HttpPost("questions/{questionId:Guid}/resolve")]
    public async Task<IActionResult> Resolve(Guid questionId)
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.ResolveAsync(userId.Value, questionId);
        return result.ToActionResult(this);
    }

    private Guid? RequireUserId() => _currentUser.UserId;
}
