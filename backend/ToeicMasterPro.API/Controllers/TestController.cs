using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Tests;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestController : ControllerBase
{
    private readonly ITestService _service;

    public TestController(ITestService service) => _service = service;

    // GET /api/test?isPublished=true
    [HttpGet]
    public async Task<IActionResult> GetList([FromQuery] bool? isPublished)
    {
        var result = await _service.GetListAsync(isPublished);
        return Ok(result);
    }

    // GET /api/test/{id}
    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // POST /api/test
    [HttpPost]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Create(CreateTestRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
            : BadRequest(new { error = result.Error });
    }
    // PUT /api/test/{id}
    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateTestRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã cập nhật." }) : BadRequest(new { error = result.Error });
    }

    // DELETE /api/test/{id}
    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    // POST /api/test/{id}/questions
    [HttpPost("{id:Guid}/questions")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> AddQuestions(Guid id, AddQuestionsRequest req)
    {
        var result = await _service.AddQuestionsAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã gán câu hỏi." }) : BadRequest(new { error = result.Error });
    }

    // DELETE /api/test/{id}/questions/{questionId}
    [HttpDelete("{id:Guid}/questions/{questionId:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> RemoveQuestion(Guid id, Guid questionId)
    {
        var result = await _service.RemoveQuestionAsync(id, questionId);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
    // Day 26: User — chỉ đề published; ?series=ETS%202026
    [HttpGet("published")]
    public async Task<IActionResult> GetPublished([FromQuery] string? series)
    {
        var result = await _service.GetPublishedListAsync(series);
        return Ok(result);
    }

    // Màn cấu trúc Part (full / chọn từng part)
    [HttpGet("{id:Guid}/structure")]
    public async Task<IActionResult> GetStructure(Guid id)
    {
        var result = await _service.GetStructureAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // Gói câu thi — ?parts=1,2,5 (bỏ trống = full)
    [HttpGet("{id:Guid}/play")]
    [Authorize] // cần login để thi
    public async Task<IActionResult> GetPlay(
        Guid id,
        [FromQuery] string? parts)
    {
        int[]? partArr = null;
        if (!string.IsNullOrWhiteSpace(parts))
        {
            partArr = parts.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => int.TryParse(s, out var n) ? n : -1)
                .Where(n => n >= 1 && n <= 7)
                .ToArray();
            if (partArr.Length == 0)
                return BadRequest(new { error = "parts phải là số 1–7, cách nhau bởi dấu phẩy." });
        }

        var result = await _service.GetPlayAsync(id, partArr);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(new { error = result.Error });
    }


}

