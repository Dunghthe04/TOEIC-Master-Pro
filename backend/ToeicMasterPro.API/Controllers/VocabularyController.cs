using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Vocabularies;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] // → /api/vocabulary
public class VocabularyController : ControllerBase
{
    private readonly IVocabularyService _service;

    public VocabularyController(IVocabularyService service) => _service = service;

    // User + CM đều xem được danh sách (Day 24 flashcard cần)
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] VocabTopic? topic,
        [FromQuery] string? search)
    {
        var result = await _service.GetListAsync(topic, search);
        return Ok(result);
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPost]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Create(CreateVocabularyRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateVocabularyRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess
            ? Ok(new { message = "Đã cập nhật." })
            : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}