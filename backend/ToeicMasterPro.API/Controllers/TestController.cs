using ToeicMasterPro.Application.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO.Compression;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.API.Services;
using ToeicMasterPro.API.Extensions;

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
        return result.ToActionResult(this);
    }

    // POST /api/test
    [HttpPost]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Create(CreateTestRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.ToCreatedResult(
            this, nameof(GetDetail), new { id = result.Value }, new { id = result.Value });
    }
    // PUT /api/test/{id}
    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateTestRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.ToActionResult(this, "Đã cập nhật.");
    }

    // DELETE /api/test/{id}
    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        // 409 khi đề đã có lượt thi (FK Restrict), 404 khi không có đề — xem TestService.
        return result.ToActionResult(this);
    }

    // POST /api/test/{id}/questions
    [HttpPost("{id:Guid}/questions")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> AddQuestions(Guid id, AddQuestionsRequest req)
    {
        var result = await _service.AddQuestionsAsync(id, req);
        return result.ToActionResult(this, "Đã gán câu hỏi.");
    }

    // DELETE /api/test/{id}/questions/{questionId}
    [HttpDelete("{id:Guid}/questions/{questionId:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> RemoveQuestion(Guid id, Guid questionId)
    {
        var result = await _service.RemoveQuestionAsync(id, questionId);
        return result.ToActionResult(this);
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
        return result.ToActionResult(this);
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
        // Đề không tồn tại HOẶC chưa publish → cùng một 404 (không tiết lộ đề nháp nào
        // đang tồn tại). Filter Part không khớp câu nào vẫn là 400. Xem TestService.
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Import một gói đề vào một đề thi cụ thể — Listening, Reading, hoặc cả hai.
    ///
    /// Luồng tổng quát (CM upload 1 lần → hệ thống tự xử lý):
    ///   1. Nhận file .zip hoặc .xlsx
    ///   2. (ZIP) Đọc manifest.json rồi ĐỐI CHIẾU với đề đang nhập
    ///   3. (ZIP) Giải nén audio/ + images/ vào wwwroot/uploads/tests/{id}/
    ///   4. Đọc Excel → tạo Question trong DB (QuestionService.ImportAsync)
    ///   5. Gán câu vừa tạo vào đề theo OrderIndex (AssignImportedToTestAsync)
    ///
    /// Cấu trúc ZIP:
    ///   manifest.json      ← tuỳ chọn, nhưng nên có; xem <see cref="ImportManifest"/>
    ///   questions.xlsx     ← Part 1–7, OrderIndex 1–200
    ///   audio/E26-T01-1.mp3, E26-T01-38-40.mp3, ...
    ///   images/E26-T01-1.png, E26-T01-65-67-a.png, E26-T01-186-190-b.png, ...
    ///
    /// 🔴 VÌ SAO MỘT ENDPOINT CHO CẢ HAI PHẦN, không tách Listening/Reading riêng:
    /// đơn vị dữ liệu thật là một ĐỀ, không phải một section. OrderIndex chạy 1–200 xuyên
    /// suốt và cả hai phần ghi vào cùng bảng TestQuestion, nên tách endpoint không tách được
    /// mô hình dữ liệu — nó chỉ thêm một trạng thái nửa vời: đề mới import Listening trông y
    /// như đề hoàn chỉnh trong danh sách, đến lúc thi mới biết thiếu 100 câu.
    ///
    /// Độ mịn khi sửa lại vẫn có, nhờ manifest cho phép gói KHÔNG ĐẦY ĐỦ: cần sửa mấy câu
    /// Reading thì gửi gói chỉ có reading, khỏi upload lại 40 MB audio.
    ///
    /// Route cũ /import-listening được giữ làm alias để UI hiện tại không vỡ.
    ///
    /// Nếu chỉ upload .xlsx (không ZIP): media phải đã có sẵn trên disk
    /// hoặc CM upload riêng qua POST /api/media/audio|image trước đó.
    /// </summary>
    [HttpPost("{id:Guid}/import")]
    [HttpPost("{id:Guid}/import-listening")]   // alias: UI hiện tại vẫn gọi route này
    [Authorize(Roles = "ContentManager")]
    [RequestSizeLimit(100 * 1024 * 1024)] // giới hạn 100MB cho gói ZIP
    public async Task<IActionResult> ImportListening(
        Guid id, IFormFile file, [FromQuery] bool dryRun = false)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        Stream excelStream;
        // Cờ này để biết có cần Dispose stream Excel sau khi import xong không
        var disposeExcel = false;
        ImportManifest? manifest = null;

        // Tên file media có trong gói — chỉ dùng cho dryRun, để đối chiếu với những file mà
        // Excel tham chiếu. Chuẩn hoá bằng đúng hàm server dùng khi giải nén, nếu không thì
        // "E26-T01-01.mp3" trong gói và "E26-T01-1.mp3" trong Excel sẽ bị coi là khác nhau.
        var zipAudio = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var zipImages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

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

            // dryRun không tạo thư mục: "không ghi gì" phải đúng nghĩa, kể cả thư mục rỗng.
            // Tạo thư mục cho một lần chạy thử rồi để nó nằm lại là rác, và tệ hơn là làm
            // người đọc tưởng đề này đã từng được import.
            if (!dryRun)
            {
                Directory.CreateDirectory(audioFolder);
                Directory.CreateDirectory(imagesFolder);
            }

            using var zip = new ZipArchive(file.OpenReadStream(), ZipArchiveMode.Read);

            // ── manifest.json: đối chiếu TRƯỚC KHI ghi bất cứ thứ gì ──
            //
            // Đặt kiểm tra ở đây, trước cả bước giải nén media, là có chủ ý: chọn nhầm gói
            // thì phải dừng khi chưa có file nào được ghi vào thư mục của đề. Kiểm sau khi
            // giải nén thì đề đã bị rải media của đề khác, dọn tay rất mệt.
            var manifestEntry = zip.Entries.FirstOrDefault(e =>
                e.Name.Equals("manifest.json", StringComparison.OrdinalIgnoreCase));

            if (manifestEntry is not null)
            {
                try
                {
                    await using var ms = manifestEntry.Open();
                    manifest = await System.Text.Json.JsonSerializer.DeserializeAsync<ImportManifest>(
                        ms, new System.Text.Json.JsonSerializerOptions
                        {
                            PropertyNameCaseInsensitive = true,
                        });
                }
                catch (System.Text.Json.JsonException ex)
                {
                    return BadRequest(new { error = $"manifest.json không đọc được: {ex.Message}" });
                }

                var mismatch = await DescribeManifestMismatchAsync(id, manifest);
                if (mismatch is not null) return BadRequest(new { error = mismatch });
            }

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

                // dryRun: chỉ GHI NHẬN tên, không copy. Đây là dữ liệu để đối chiếu với những
                // file mà Excel tham chiếu — bước kiểm giá trị nhất của chế độ chạy thử.
                if (dryRun)
                {
                    (destFolder == audioFolder ? zipAudio : zipImages).Add(name);
                    continue;
                }

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
            var importResult = await _questionService.ImportAsync(
                excelStream, new ImportQuestionOptions(id, true, DryRun: dryRun));

            // ── dryRun: dừng ở đây, không gán, không ghi ──
            //
            // Trả về HTTP 200 chứ không phải 4xx dù có lỗi trong gói: chạy thử THÀNH CÔNG có
            // nghĩa là "đã kiểm xong và đây là kết quả". Lỗi của gói nằm trong thân báo cáo.
            // Trả 4xx thì client không phân biệt được "gói sai" với "gọi API sai".
            if (dryRun)
                return Ok(await BuildDryRunReportAsync(id, manifest, importResult, zipAudio, zipImages, ext));

            // Bước B: gán các câu vừa tạo vào bảng TestQuestion theo OrderIndex
            var assigned = await AssignImportedToTestAsync(id, importResult);

            // Giữ nguyên hai khoá `import` và `assignedToTest` — UI hiện tại đọc đúng hai
            // khoá đó (TestQuestionsPage đọc res.import.successCount và res.assignedToTest).
            // Thêm khoá mới thì an toàn, đổi tên khoá cũ là làm vỡ UI mà không báo lỗi.
            return Ok(new
            {
                import = importResult,       // báo cáo: bao nhiêu câu OK/lỗi, danh sách QuestionId
                assignedToTest = assigned,     // số câu đã gán vào đề
                manifest = manifest is null ? null : new
                {
                    manifest.Series,
                    manifest.Title,
                    sections = manifest.Sections ?? [],
                    manifest.Source,
                },
                // Phần nào thật sự có câu trong gói, suy từ OrderIndex chứ không tin manifest:
                // manifest là lời khai, còn OrderIndex là dữ liệu.
                sectionsImported = DescribeSections(importResult),
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
        return result.ToActionResult(this, new { assigned = result.Value });
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
    /// <summary>
    /// Báo cáo của lần chạy thử: gói này SẼ làm gì với đề, và có gì sai.
    ///
    /// MỤC ĐÍCH: import 200 câu là việc khó hoàn tác. Bốn lớp kiểm dưới đây đều chỉ trả lời
    /// được TRƯỚC KHI ghi, và cả bốn đều là lỗi thật đã hoặc sẽ gặp:
    ///
    ///   1. Dòng Excel lỗi          — hiện đã có, nhưng chỉ biết sau khi đã tạo câu
    ///   2. OrderIndex trùng/thiếu  — hai dòng cùng vị trí thì một dòng bị mất im lặng
    ///   3. Media tham chiếu nhưng KHÔNG có trong gói — câu mất tiếng, không lỗi nào báo
    ///   4. Vị trí SẼ BỊ GHI ĐÈ     — câu trả lời cho "import này phá mất cái gì"
    ///
    /// Lớp 3 và 4 là hai lớp mà chạy thật không bao giờ nói cho bạn biết.
    /// </summary>
    private async Task<object> BuildDryRunReportAsync(
        Guid testId, ImportManifest? manifest, ImportResultResponse import,
        HashSet<string> zipAudio, HashSet<string> zipImages, string ext)
    {
        var rows = import.Created ?? [];
        var orders = rows.Where(r => r.OrderIndex.HasValue).Select(r => r.OrderIndex!.Value).ToList();

        // ── OrderIndex: trùng và thiếu ──
        // Trùng là lỗi ÂM THẦM nguy hiểm nhất ở đây: UpsertQuestionsByOrderAsync ghi lần lượt
        // nên dòng sau đè dòng trước, và báo cáo vẫn nói "2 câu thành công".
        var duplicates = orders.GroupBy(o => o).Where(g => g.Count() > 1)
            .Select(g => g.Key).OrderBy(o => o).ToList();

        var missing = orders.Count == 0
            ? []
            : Enumerable.Range(orders.Min(), orders.Max() - orders.Min() + 1)
                .Where(n => !orders.Contains(n)).ToList();

        // ── Media: file nào Excel trỏ tới mà gói không có ──
        // Chỉ kiểm được khi upload ZIP. Với .xlsx trần thì media phải có sẵn trên disk, và
        // nói "thiếu" lúc này là nói sai — nên bỏ qua, và ghi rõ lý do bỏ qua.
        var audioMissing = new List<string>();
        var imageMissing = new List<string>();
        var checkedMedia = ext == ".zip";

        if (checkedMedia)
        {
            var existingAudio = SafeList(_paths.TestAudioFolder(testId));
            var existingImages = SafeList(_paths.TestImageFolder(testId));

            foreach (var r in rows)
            {
                foreach (var name in SplitMedia(r.AudioFile))
                    if (!zipAudio.Contains(name) && !existingAudio.Contains(name))
                        audioMissing.Add($"câu {r.OrderIndex}: {name}");

                foreach (var name in SplitMedia(r.ImageFile))
                    if (!zipImages.Contains(name) && !existingImages.Contains(name))
                        imageMissing.Add($"câu {r.OrderIndex}: {name}");
            }
        }

        var referencedAudio = rows.SelectMany(r => SplitMedia(r.AudioFile))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var referencedImages = rows.SelectMany(r => SplitMedia(r.ImageFile))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        // File nằm trong gói mà không câu nào dùng. Không phải lỗi, nhưng đáng báo: thường
        // là dấu hiệu Excel ghi sai tên, và nó CHE mất lỗi thật (câu không có tiếng).
        var unused = zipAudio.Where(n => !referencedAudio.Contains(n))
            .Concat(zipImages.Where(n => !referencedImages.Contains(n)))
            .OrderBy(n => n).ToList();

        // ── Vị trí sẽ bị ghi đè ──
        var willReplace = new List<int>();
        var test = await _service.GetByIdAsync(testId);

        if (test.IsSuccess && test.Value is not null)
        {
            var taken = test.Value.Questions.Select(q => q.OrderIndex).ToHashSet();
            willReplace = orders.Where(taken.Contains).Distinct().OrderBy(o => o).ToList();
        }

        var blocking = import.FailedCount + duplicates.Count + audioMissing.Count + imageMissing.Count;

        return new
        {
            dryRun = true,
            ok = blocking == 0,
            summary = blocking == 0
                ? $"Gói hợp lệ. Sẽ tạo {rows.Count} câu" +
                  (willReplace.Count > 0 ? $", trong đó THAY {willReplace.Count} câu đang có trong đề." : ".")
                : $"Gói có {blocking} vấn đề cần sửa trước khi import.",

            manifest = manifest is null ? null : new
            {
                manifest.Series,
                manifest.Title,
                sections = manifest.Sections ?? [],
                manifest.Source,
            },

            rows = new
            {
                total = import.TotalRows,
                valid = rows.Count,
                invalid = import.FailedCount,
            },
            errors = import.Errors,

            sections = DescribeSections(import),
            orderIndex = new
            {
                min = orders.Count == 0 ? (int?)null : orders.Min(),
                max = orders.Count == 0 ? (int?)null : orders.Max(),
                duplicates,
                missing,
            },

            media = new
            {
                @checked = checkedMedia,
                note = checkedMedia
                    ? null
                    : "Chỉ upload .xlsx nên không đối chiếu được media — file phải có sẵn trên server.",
                audioReferenced = referencedAudio.Count,
                audioMissing,
                imageReferenced = referencedImages.Count,
                imageMissing,
                unusedInPackage = unused,
            },

            willReplace,
        };
    }

    /// <summary>
    /// Tách giá trị cột AudioFile/ImageFile thành danh sách tên file đã chuẩn hoá.
    ///
    /// Một ô có thể chứa NHIỀU file, nối bằng ';' hoặc '|' — dùng cho cụm Part 6/7 có 2–3 văn
    /// bản. Chuẩn hoá bằng đúng hàm server dùng khi giải nén, nếu không thì "E26-T01-01.mp3"
    /// trong gói và "E26-T01-1.mp3" trong Excel bị coi là hai file khác nhau và báo thiếu oan.
    /// </summary>
    private static IEnumerable<string> SplitMedia(string? cell)
    {
        if (string.IsNullOrWhiteSpace(cell)) return [];

        return cell.Split([';', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(p => ToeicMediaNaming.NormalizeMediaFileName(Path.GetFileName(p)))
            .Where(n => !string.IsNullOrEmpty(n));
    }

    /// <summary>Tên file đã có trên disk của đề. Thư mục chưa tồn tại là bình thường.</summary>
    private static HashSet<string> SafeList(string folder)
    {
        if (!Directory.Exists(folder)) return new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        return Directory.GetFiles(folder)
            .Select(f => Path.GetFileName(f))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// So manifest với đề đang nhập. Trả về câu mô tả lệch, hoặc null nếu khớp.
    ///
    /// 🔴 LỖI NÓ CHẶN: upload Test1.zip vào đề Test 3. Không có kiểm này thì import chạy
    /// trơn, báo "100 câu thành công", và đề Test 3 bị thay bằng nội dung Test 1 — đứng ở
    /// góc độ dữ liệu thì mọi thứ hợp lệ nên không có lỗi nào phát ra.
    ///
    /// So sau khi CHUẨN HOÁ, không so chuỗi thô:
    ///   Title  qua ToTestCode  → "Test 1" và "Test1" đều ra T01 (khớp), "Test 3" ra T03 (lệch)
    ///   Series qua ToExamCode  → bắt được đúng cái bẫy: Series đặt "ETS 2026" sinh ra
    ///                            "ETS2026" chứ không phải "E26"
    /// </summary>
    private async Task<string?> DescribeManifestMismatchAsync(Guid testId, ImportManifest? manifest)
    {
        if (manifest is null) return null;

        var test = await _service.GetByIdAsync(testId);
        if (!test.IsSuccess || test.Value is null)
            return "Không tìm thấy đề thi để đối chiếu manifest.";

        var target = test.Value;

        if (!string.IsNullOrWhiteSpace(manifest.Title))
        {
            var want = ToeicMediaNaming.ToTestCode(manifest.Title);
            var got = ToeicMediaNaming.ToTestCode(target.Title);

            if (!want.Equals(got, StringComparison.OrdinalIgnoreCase))
                return $"Gói này là của đề \"{manifest.Title}\" ({want}) nhưng bạn đang nhập vào " +
                       $"đề \"{target.Title}\" ({got}). Kiểm lại đã chọn đúng gói chưa — " +
                       "import sai gói sẽ THAY nội dung đề hiện tại.";
        }

        if (!string.IsNullOrWhiteSpace(manifest.Series))
        {
            var want = ToeicMediaNaming.ToExamCode(manifest.Series);
            var got = ToeicMediaNaming.ToExamCode(target.Series ?? "");

            if (!want.Equals(got, StringComparison.OrdinalIgnoreCase))
                return $"Gói này thuộc bộ đề \"{manifest.Series}\" (mã {want}) nhưng đề trên web " +
                       $"có Series \"{target.Series}\" (mã {got}). Sửa Series của đề thành " +
                       $"\"{manifest.Series}\" rồi import lại — lệch mã đề thì câu sẽ mất media.";
        }

        return null;
    }

    /// <summary>
    /// Suy ra gói vừa import chứa phần nào, DỰA TRÊN OrderIndex thật của các câu đã tạo.
    ///
    /// Không đọc từ manifest: manifest là lời khai của người đóng gói, còn OrderIndex là dữ
    /// liệu thật vừa ghi vào DB. Khai "cả hai phần" mà Excel chỉ có 100 dòng thì báo cáo phải
    /// nói đúng là chỉ có Listening.
    /// </summary>
    private static string[] DescribeSections(ImportResultResponse import)
    {
        if (import.Created is null || import.Created.Count == 0) return [];

        var orders = import.Created.Select(c => c.OrderIndex ?? 0).ToList();
        var sections = new List<string>();

        if (orders.Any(o => o is >= 1 and <= 100)) sections.Add("listening");
        if (orders.Any(o => o is >= 101 and <= 200)) sections.Add("reading");

        return [.. sections];
    }

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

