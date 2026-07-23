using ToeicMasterPro.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Application.DTOs.Tests;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TestController : ControllerBase
{
    private readonly ITestService _service;
    private readonly IQuestionService _questionService;
    private readonly IWebHostEnvironment _env;

    public TestController(ITestService service, IQuestionService questionService, IWebHostEnvironment env)
    {
        _service = service;
        _questionService = questionService;
        _env = env;
    }

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

    /// <summary>Import Excel hoặc ZIP (questions.xlsx + audio/ + images/) vào đề — Part 1–4.</summary>
    [HttpPost("{id:Guid}/import-listening")]
    [Authorize(Roles = "Admin,ContentManager")]
    [RequestSizeLimit(100 * 1024 * 1024)]
    public async Task<IActionResult> ImportListening(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        Stream excelStream;
        var disposeExcel = false;

        if (ext == ".zip")
        {
            var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
            var audioFolder = Path.Combine(webRoot, "uploads", "tests", id.ToString(), "audio");
            var imagesFolder = Path.Combine(webRoot, "uploads", "tests", id.ToString(), "images");
            Directory.CreateDirectory(audioFolder);
            Directory.CreateDirectory(imagesFolder);

            using var zip = new ZipArchive(file.OpenReadStream(), ZipArchiveMode.Read);
            var entry = zip.Entries.FirstOrDefault(e =>
                e.Name.Equals("questions.xlsx", StringComparison.OrdinalIgnoreCase))
                ?? zip.Entries.FirstOrDefault(e => e.Name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase));

            if (entry is null)
                return BadRequest(new { error = "ZIP phải chứa questions.xlsx (hoặc file .xlsx)." });

            foreach (var ae in zip.Entries.Where(e => !string.IsNullOrEmpty(e.Name)))
            {
                var zipPath = ae.FullName.Replace('\\', '/');
                string? destFolder = null;
                if (zipPath.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
                    || zipPath.Contains("/audio/", StringComparison.OrdinalIgnoreCase))
                    destFolder = audioFolder;
                else if (zipPath.StartsWith("images/", StringComparison.OrdinalIgnoreCase)
                    || zipPath.Contains("/images/", StringComparison.OrdinalIgnoreCase))
                    destFolder = imagesFolder;

                if (destFolder is null) continue;

                var name = ToeicMediaNaming.NormalizeMediaFileName(Path.GetFileName(ae.Name));
                if (string.IsNullOrEmpty(name)) continue;
                var dest = Path.Combine(destFolder, name);
                await using var src = ae.Open();
                await using var dst = System.IO.File.Create(dest);
                await src.CopyToAsync(dst);
            }

            // Copy Excel ra memory — tránh stream bị đóng khi ZipArchive dispose
            var excelMs = new MemoryStream();
            await using (var entryStream = entry.Open())
                await entryStream.CopyToAsync(excelMs);
            excelMs.Position = 0;
            excelStream = excelMs;
            disposeExcel = true;
        }
        else if (ext == ".xlsx")
        {
            excelStream = file.OpenReadStream();
            disposeExcel = true;
        }
        else
        {
            return BadRequest(new { error = "Chỉ chấp nhận .xlsx hoặc .zip." });
        }

        try
        {
            var importResult = await _questionService.ImportAsync(excelStream, new ImportQuestionOptions(id, true));
            var assigned = await AssignImportedToTestAsync(id, importResult);
            return Ok(new
            {
                import = importResult,
                assignedToTest = assigned
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = $"Import thất bại: {ex.Message}" });
        }
        finally
        {
            if (disposeExcel) await excelStream.DisposeAsync();
        }
    }

    /// <summary>Gán nhanh mọi câu Listening published chưa có trong đề.</summary>
    [HttpPost("{id:Guid}/assign-listening")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> AssignListening(Guid id)
    {
        var result = await _service.AssignListeningQuestionsAsync(id);
        return result.IsSuccess
            ? Ok(new { assigned = result.Value })
            : BadRequest(new { error = result.Error });
    }

    private async Task<int> AssignImportedToTestAsync(Guid testId, ImportResultResponse import)
    {
        if (import.Created is null || import.Created.Count == 0) return 0;

        var items = import.Created
            .Select((c, i) => new QuestionOrderItem(
                c.QuestionId,
                c.OrderIndex ?? (i + 1)))
            .ToList();

        var result = await _service.UpsertQuestionsByOrderAsync(testId, new AddQuestionsRequest(items));
        return result.IsSuccess ? items.Count : 0;
    }


}

