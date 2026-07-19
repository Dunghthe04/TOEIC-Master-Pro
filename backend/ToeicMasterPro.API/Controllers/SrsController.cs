using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Srs;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/srs")]
[Authorize] // mọi endpoint cần login — SRS gắn với user
public class SrsController : ControllerBase
{
    private readonly ISrsService _srs;

    public SrsController(ISrsService srs) => _srs = srs;

    // Bắt đầu học 1 từ trong kho
    [HttpPost("learn/{vocabularyId:Guid}")]
    public async Task<IActionResult> Learn(Guid vocabularyId)
    {
        var result = await _srs.LearnAsync(vocabularyId);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // Thẻ đến hạn ôn hôm nay (Day 24 flashcard gọi API này)
    [HttpGet("due")]
    public async Task<IActionResult> GetDue()
    {
        var result = await _srs.GetDueAsync();
        return Ok(result);
    }

    // Nộp kết quả ôn (quality 0–5)
    [HttpPost("review")]
    public async Task<IActionResult> Review(ReviewRequest req)
    {
        var result = await _srs.ReviewAsync(req);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }

    // Thanh tiến độ
    [HttpGet("progress")]
    public async Task<IActionResult> GetProgress()
    {
        var result = await _srs.GetProgressAsync();
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}