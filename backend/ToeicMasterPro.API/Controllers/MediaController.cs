using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Upload media cho CM — audio Listening (Part 1–4) và ảnh Part 1.
/// Lưu vào wwwroot; trả URL để gán vào Question.AudioUrl / ImageUrl.
/// </summary>
[ApiController]
[Route("api/media")]
[Authorize(Roles = "Admin,ContentManager")]
public class MediaController : ControllerBase
{
    private readonly IWebHostEnvironment _env;

    private static readonly string[] AudioExtensions = [".mp3", ".wav", ".m4a"];
    private static readonly string[] ImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

    public MediaController(IWebHostEnvironment env) => _env = env;

    /// <summary>
    /// Upload audio. testId có → uploads/tests/{id}/audio/ ; không → uploads/listening/audio/
    /// Giữ tên file gốc (sanitize) — quy ước E26-T01-1.mp3.
    /// </summary>
    [HttpPost("audio")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public Task<IActionResult> UploadAudio(IFormFile file, [FromQuery] Guid? testId)
        => SaveFileAsync(file, testId, "audio", AudioExtensions, 15 * 1024 * 1024);

    /// <summary>Upload ảnh Part 1.</summary>
    [HttpPost("image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public Task<IActionResult> UploadImage(IFormFile file, [FromQuery] Guid? testId)
        => SaveFileAsync(file, testId, "images", ImageExtensions, 5 * 1024 * 1024);

    private async Task<IActionResult> SaveFileAsync(
        IFormFile file,
        Guid? testId,
        string subFolder,
        string[] allowedExt,
        long maxBytes)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file." });
        if (file.Length > maxBytes)
            return BadRequest(new { error = $"File quá lớn. Tối đa {maxBytes / 1024 / 1024}MB." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowedExt.Contains(ext))
            return BadRequest(new { error = $"Định dạng không hỗ trợ. Cho phép: {string.Join(", ", allowedExt)}" });

        var safeName = SanitizeFileName(Path.GetFileNameWithoutExtension(file.FileName)) + ext;
        if (string.IsNullOrWhiteSpace(safeName) || safeName == ext)
            safeName = $"{Guid.NewGuid()}{ext}";

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        string relativeUrl;
        string folder;

        if (testId is { } tid)
        {
            folder = Path.Combine(webRoot, "uploads", "tests", tid.ToString(), subFolder);
            relativeUrl = $"/uploads/tests/{tid}/{subFolder}/{safeName}";
        }
        else
        {
            folder = Path.Combine(webRoot, "uploads", "listening", subFolder);
            relativeUrl = $"/uploads/listening/{subFolder}/{safeName}";
        }

        Directory.CreateDirectory(folder);
        var fullPath = Path.Combine(folder, safeName);
        await using (var stream = System.IO.File.Create(fullPath))
            await file.CopyToAsync(stream);

        return Ok(new { url = relativeUrl, fileName = safeName });
    }

    /// <summary>Chỉ giữ chữ, số, gạch ngang/gạch dưới — tránh path traversal.</summary>
    private static string SanitizeFileName(string name)
    {
        var chars = name.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray();
        return new string(chars);
    }
}
