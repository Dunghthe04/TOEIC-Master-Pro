using ToeicMasterPro.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.API.Services;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// KHÔNG có [Authorize] cấp class — mọi action bên dưới đã ghi rõ Roles, và endpoint
// nào không có metadata thì fallback policy (Program.cs) đã đòi đăng nhập.
//
// ⚠️ [Authorize] cấp class + cấp action CỘNG DỒN (AND), không ghi đè. Đặt Roles ở cấp
// class rồi mở rộng ở action là KHÔNG được — action phải thỏa cả hai. Nên siết ở action.
public class TestController : ControllerBase
{
    private readonly ITestService _service;
    private readonly IQuestionService _questionService;
    private readonly IWebHostEnvironment _env;
    private readonly MediaPathProvider _paths;

    public TestController(
        ITestService service,
        IQuestionService questionService,
        IWebHostEnvironment env,
        MediaPathProvider paths)
    {
        _service = service;
        _questionService = questionService;
        _env = env;
        _paths = paths;
    }

    // GET /api/test?isPublished=true
    // Admin ĐỌC được (read-only auditor): học viên báo "đề X sai" thì Admin kiểm được.
    // Nhưng KHÔNG sửa — Admin bị chiếm tài khoản thì kẻ tấn công không đổi được nội dung đề.
    [HttpGet]
    [Authorize(Roles = "ContentManager,Admin")]
    public async Task<IActionResult> GetList([FromQuery] bool? isPublished)
    {
        var result = await _service.GetListAsync(isPublished);
        return Ok(result);
    }

    // GET /api/test/{id}
    [HttpGet("{id:Guid}")]
    [Authorize(Roles = "ContentManager,Admin")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // POST /api/test
    [HttpPost]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Create(CreateTestRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
            : BadRequest(new { error = result.Error });
    }
    // PUT /api/test/{id}
    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateTestRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã cập nhật." }) : BadRequest(new { error = result.Error });
    }

    // DELETE /api/test/{id}
    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }

    // POST /api/test/{id}/questions
    [HttpPost("{id:Guid}/questions")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> AddQuestions(Guid id, AddQuestionsRequest req)
    {
        var result = await _service.AddQuestionsAsync(id, req);
        return result.IsSuccess ? Ok(new { message = "Đã gán câu hỏi." }) : BadRequest(new { error = result.Error });
    }

    // DELETE /api/test/{id}/questions/{questionId}
    [HttpDelete("{id:Guid}/questions/{questionId:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> RemoveQuestion(Guid id, Guid questionId)
    {
        var result = await _service.RemoveQuestionAsync(id, questionId);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
    // Day 26: User — chỉ đề published; ?series=ETS%202026
    //
    // [AllowAnonymous] có chủ ý — landing page cho khách vãng lai xem CÓ NHỮNG ĐỀ NÀO
    // trước khi đăng ký, giống các trang luyện thi TOEIC thật.
    // Chỉ trả đề ĐÃ PUBLISH và chỉ metadata (tên, series, số câu, thời lượng) —
    // KHÔNG lộ câu hỏi hay đáp án. Muốn thi thật thì /play vẫn đòi role User.
    [HttpGet("published")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublished([FromQuery] string? series)
    {
        var result = await _service.GetPublishedListAsync(series);
        return Ok(result);
    }

    // Màn cấu trúc Part (full / chọn từng part).
    // [AllowAnonymous] cùng lý do trên: khách xem được bảng "Part 1: 6 câu, Part 2: 25 câu..."
    // để biết đề dài thế nào. Vẫn không có nội dung câu hỏi.
    [HttpGet("{id:Guid}/structure")]
    [AllowAnonymous]
    public async Task<IActionResult> GetStructure(Guid id)
    {
        var result = await _service.GetStructureAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // Gói câu thi — ?parts=1,2,5 (bỏ trống = full)
    [HttpGet("{id:Guid}/play")]
    [Authorize(Roles = "User")] // chỉ học viên thi
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

    /// <summary>
    /// Import gói Listening Part 1–4 vào một đề thi cụ thể.
    ///
    /// Luồng tổng quát (CM upload 1 lần → hệ thống tự xử lý):
    ///   1. Nhận file .zip hoặc .xlsx
    ///   2. (ZIP) Giải nén audio/ + images/ vào wwwroot/uploads/tests/{id}/
    ///   3. Đọc Excel → tạo Question trong DB (QuestionService.ImportAsync)
    ///   4. Gán câu vừa tạo vào đề theo OrderIndex (AssignImportedToTestAsync)
    ///
    /// Cấu trúc ZIP khuyến nghị:
    ///   questions.xlsx
    ///   audio/ETS26-T01-1.mp3, ETS26-T01-7.mp3, ETS26-T01-38-40.mp3, ...
    ///   images/ETS26-T01-1.png, ...
    ///
    /// Nếu chỉ upload .xlsx (không ZIP): media phải đã có sẵn trên disk
    /// hoặc CM upload riêng qua POST /api/media/audio|image trước đó.
    /// </summary>
    [HttpPost("{id:Guid}/import-listening")]
    [Authorize(Roles = "ContentManager")]
    [RequestSizeLimit(100 * 1024 * 1024)] // giới hạn 100MB cho gói ZIP
    public async Task<IActionResult> ImportListening(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        Stream excelStream;
        // Cờ này để biết có cần Dispose stream Excel sau khi import xong không
        var disposeExcel = false;

        // ── Nhánh 1: file ZIP (Excel + media trong cùng gói) ──────────────────
        if (ext == ".zip")
        {
            // Thư mục lưu media của đề này — khớp URL mà QuestionService sẽ ghi vào DB.
            // Ví dụ: /api/media/tests/{id}/audio/ETS26-T01-7.mp3
            //
            // Trước đây giải nén vào wwwroot → file thành public NGAY khi upload,
            // vì UseStaticFiles serve toàn bộ wwwroot không phân biệt thư mục con.
            var audioFolder = _paths.TestAudioFolder(id);
            var imagesFolder = _paths.TestImageFolder(id);
            Directory.CreateDirectory(audioFolder);
            Directory.CreateDirectory(imagesFolder);

            using var zip = new ZipArchive(file.OpenReadStream(), ZipArchiveMode.Read);

            // Ưu tiên file tên questions.xlsx; không có thì lấy file .xlsx đầu tiên trong ZIP
            var entry = zip.Entries.FirstOrDefault(e =>
                e.Name.Equals("questions.xlsx", StringComparison.OrdinalIgnoreCase))
                ?? zip.Entries.FirstOrDefault(e => e.Name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase));

            if (entry is null)
                return BadRequest(new { error = "ZIP phải chứa questions.xlsx (hoặc file .xlsx)." });

            // Duyệt mọi entry trong ZIP — chỉ copy file nằm trong thư mục audio/ hoặc images/
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

                // Bỏ qua questions.xlsx và các file không thuộc audio/images
                if (destFolder is null) continue;

                // Chuẩn hóa tên: E26-T01-07.mp3 → E26-T01-7.mp3 (khớp quy ước ToeicMediaNaming)
                var name = ToeicMediaNaming.NormalizeMediaFileName(Path.GetFileName(ae.Name));
                if (string.IsNullOrEmpty(name)) continue;
                var dest = Path.Combine(destFolder, name);
                await using var src = ae.Open();
                await using var dst = System.IO.File.Create(dest);
                await src.CopyToAsync(dst);
            }

            // Copy Excel ra MemoryStream — bắt buộc vì ZipArchive dispose sẽ đóng stream gốc
            var excelMs = new MemoryStream();
            await using (var entryStream = entry.Open())
                await entryStream.CopyToAsync(excelMs);
            excelMs.Position = 0;
            excelStream = excelMs;
            disposeExcel = true;
        }
        // ── Nhánh 2: chỉ Excel (media upload riêng hoặc đã có trên server) ─────
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
            // Bước A: đọc Excel → tạo Question
            // ImportQuestionOptions(id, true):
            //   - TestId = id → load Series/Title của đề để tự sinh tên file audio/ảnh
            //   - AssignToTest = true (cờ dự phòng; gán thực tế ở bước B bên dưới)
            var importResult = await _questionService.ImportAsync(excelStream, new ImportQuestionOptions(id, true));

            // Bước B: gán các câu vừa tạo vào bảng TestQuestion theo OrderIndex
            var assigned = await AssignImportedToTestAsync(id, importResult);

            return Ok(new
            {
                import = importResult,       // báo cáo: bao nhiêu câu OK/lỗi, danh sách QuestionId
                assignedToTest = assigned      // số câu đã gán vào đề
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
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> AssignListening(Guid id)
    {
        var result = await _service.AssignListeningQuestionsAsync(id);
        return result.IsSuccess
            ? Ok(new { assigned = result.Value })
            : BadRequest(new { error = result.Error });
    }

    /// <summary>
    /// Gán các câu vừa import vào đề thi (bảng TestQuestion).
    ///
    /// Mỗi dòng Excel có cột OrderIndex (1–100) → vị trí câu trong đề TOEIC.
    /// Nếu OrderIndex trống → fallback theo thứ tự dòng import (1, 2, 3...).
    ///
    /// Gọi TestService.UpsertQuestionsByOrderAsync:
    ///   - Trùng OrderIndex → xóa câu cũ, gán câu mới (import lại không bị duplicate).
    /// </summary>
    private async Task<int> AssignImportedToTestAsync(Guid testId, ImportResultResponse import)
    {
        if (import.Created is null || import.Created.Count == 0) return 0;

        var items = import.Created
            .Select((c, i) => new QuestionOrderItem(
                c.QuestionId,
                c.OrderIndex ?? (i + 1))) // OrderIndex từ Excel; không có thì dùng thứ tự dòng
            .ToList();

        var result = await _service.UpsertQuestionsByOrderAsync(testId, new AddQuestionsRequest(items));
        return result.IsSuccess ? items.Count : 0;
    }


}

