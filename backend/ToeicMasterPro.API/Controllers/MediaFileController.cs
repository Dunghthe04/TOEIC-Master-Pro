using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using ToeicMasterPro.API.Services;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Serve audio/ảnh đề thi từ protected-media/ (NGOÀI wwwroot).
///
/// Vì sao cần controller thay vì UseStaticFiles: static file middleware là TERMINAL,
/// khớp path là trả file rồi dừng — không bao giờ chạm UseAuthorization. Endpoint thì có.
/// </summary>
[ApiController]
[Route("api/media/tests")]
[Authorize]   // học viên đang thi cần tải audio → chỉ cần đăng nhập, không cần role CM
public class MediaFileController : ControllerBase
{
    private readonly MediaPathProvider _paths;
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public MediaFileController(MediaPathProvider paths) => _paths = paths;

    /// <summary>
    /// GET /api/media/tests/{testId}/audio/ETS26-T01-1.mp3
    /// GET /api/media/tests/{testId}/images/part1-01.jpg
    /// </summary>
    [HttpGet("{testId:Guid}/{subFolder}/{fileName}")]
    public IActionResult GetFile(Guid testId, string subFolder, string fileName)
    {
        var fullPath = _paths.ResolveProtectedFile(testId, subFolder, fileName);

        // 404 cho MỌI trường hợp không hợp lệ — không phân biệt "sai path" với "không tồn tại",
        // tránh giúp kẻ tấn công dò cấu trúc thư mục.
        if (fullPath is null) return NotFound();

        if (!ContentTypes.TryGetContentType(fullPath, out var contentType))
            contentType = "application/octet-stream";

        // enableRangeProcessing: BẮT BUỘC cho audio — không có thì không tua được,
        // và Safari trên iOS từ chối phát file không hỗ trợ Range request.
        return PhysicalFile(fullPath, contentType, enableRangeProcessing: true);
    }
}
