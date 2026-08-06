using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// ⚠️ [Authorize] cấp class và cấp action CỘNG DỒN (AND), KHÔNG ghi đè nhau.
// Đặt Roles="ContentManager" ở cấp class rồi mở rộng "ContentManager,Admin" ở action
// là KHÔNG được — Admin phải thỏa CẢ HAI nên vẫn 403. Đã kiểm chứng bằng curl.
//
// Nên: không đặt gì ở cấp class, siết Roles ở từng action.
// Endpoint không có metadata thì fallback policy (Program.cs) đã đòi đăng nhập.
//   ĐỌC  → ContentManager + Admin (Admin là read-only auditor)
//   GHI  → chỉ ContentManager
public class QuestionController : ControllerBase
{
    private readonly IQuestionService _service;
    public QuestionController(IQuestionService service)
    {
        _service = service;
    }

    //GET danh sách + lọc tùy chọn — Admin xem được để kiểm khi học viên báo lỗi đề
    [HttpGet]
    [Authorize(Roles = "ContentManager,Admin")]
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
    [Authorize(Roles = "ContentManager,Admin")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    //Tạo câu hỏi -> chỉ CM (Admin không soạn nội dung)
    [HttpPost]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Create(CreateQuestionRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
                ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
                : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateQuestionRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã cập nhật." }) : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    // POST /api/question/import
    [HttpPost("import")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Import(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx")
            return BadRequest(new { error = "Chỉ chấp nhận file .xlsx." });

        await using var stream = file.OpenReadStream();
        var result = await _service.ImportAsync(stream);
        return Ok(result);
    }

    /// <summary>Tải file Excel mẫu import câu hỏi (có cột AudioFile, ImageFile).</summary>
    [HttpGet("import-template")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> DownloadImportTemplate()
    {
        var bytes = await _service.GetImportTemplateAsync();
        return File(bytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "toeic-questions-template.xlsx");
    }
}