using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Practice;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] // → /api/practice
[Authorize] // mọi user đã login đều luyện được
public class PracticeController : ControllerBase
{
    private readonly IPracticeService _service;

    public PracticeController(IPracticeService service) => _service = service;

    // GET /api/practice/questions?part=5&difficulty=Easy&tag=Grammar&limit=10
    [HttpGet("questions")]
    public async Task<IActionResult> GetQuestions(
        [FromQuery] QuestionPart? part,
        [FromQuery] DifficultyLevel? difficulty,
        [FromQuery] string? tag,
        [FromQuery] int limit = 10)
    {
        var result = await _service.GetQuestionsAsync(part, difficulty, tag, limit);
        return Ok(result);
    }

    // POST /api/practice/submit
    [HttpPost("submit")]
    public async Task<IActionResult> Submit(SubmitPracticeRequest req)
    {
        var result = await _service.SubmitAsync(req);
        return result.IsSuccess
            ? Ok(result.Value)
            : BadRequest(new { error = result.Error });
    }
}