using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionController : ControllerBase
{
    private readonly IQuestionService _service;
    public QuestionController(IQuestionService service)
    {
        _service = service;
    }

    //GET danh sách + lọc tùy chọn
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] QuestionPart? part,
        [FromQuery] DifficultyLevel? difficulty,
        [FromQuery] bool? isPublished,
        [FromQuery] string? tag)
    {
        var result = await _service.GetListAsync(part, difficulty, isPublished, tag);
        return Ok(result);
    }

    //GET DETAIL
    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    //Tạo câu hỏi -> chỉ CM
    [HttpPost]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Create(CreateQuestionRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
                ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
                : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateQuestionRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã cập nhật." }) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}