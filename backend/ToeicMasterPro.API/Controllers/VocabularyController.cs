using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.API.Extensions;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Vocabularies;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] // → /api/vocabulary
// ĐỌC: cả 3 vai — User học flashcard, CM kiểm nội dung vừa soạn, Admin xem.
// GHI: chỉ ContentManager (xem [Authorize] cấp action bên dưới).
[Authorize(Roles = "User,ContentManager,Admin")]
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
        // Trước đây hardcode NotFound cho MỌI lỗi — ngược lại vấn đề của các chỗ khác,
        // nhưng cùng bản chất: status không theo loại lỗi thật. Giờ theo ErrorType.
        return result.ToActionResult(this);
    }

    [HttpPost]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Create(CreateVocabularyRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.ToCreatedResult(
            this, nameof(GetDetail), new { id = result.Value }, new { id = result.Value });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateVocabularyRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.ToActionResult(this, "Đã cập nhật.");
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.ToActionResult(this);
    }
}