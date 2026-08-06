using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.API.Services;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Serve audio/ảnh đề thi từ protected-media/ (NGOÀI wwwroot).
///
/// Vì sao cần controller thay vì UseStaticFiles: static file middleware là TERMINAL,
/// khớp path là trả file rồi dừng — không bao giờ chạm UseAuthorization. Endpoint thì có.
///
/// BA TẦNG BẢO VỆ:
///   1. Token ký HMAC, sống 10 phút          → chống người chưa đăng nhập
///   2. Kiểm IsPublished khi CẤP token       → chống học viên xem đề nháp
///   3. Token ký theo testId                 → chống dùng token đề 1 tải media đề 2
/// </summary>
[ApiController]
[Route("api/media")]
public class MediaFileController : ControllerBase
{
    private readonly MediaPathProvider _paths;
    private readonly MediaTokenService _tokens;
    private readonly ITestService _tests;
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    public MediaFileController(
        MediaPathProvider paths,
        MediaTokenService tokens,
        ITestService tests)
    {
        _paths = paths;
        _tokens = tokens;
        _tests = tests;
    }

    /// <summary>
    /// Cấp token media cho MỘT đề. Gọi qua axios nên CÓ Bearer token.
    ///
    /// Kiểm quyền Ở ĐÂY (không phải lúc tải file) vì cấp token 1 lần/10 phút,
    /// còn tải file thì 100+ lần — không thể query DB mỗi thẻ &lt;img&gt;.
    /// </summary>
    [HttpGet("token/{testId:Guid}")]
    // User: tải audio khi thi · CM: kiểm đề vừa soạn · Admin: kiểm khi học viên báo lỗi
    [Authorize(Roles = "User,ContentManager,Admin")]
    public async Task<IActionResult> GetToken(Guid testId)
    {
        var result = await _tests.GetByIdAsync(testId);
        if (!result.IsSuccess || result.Value is null)
            return NotFound(new { error = "Không tìm thấy đề thi." });

        // CM/Admin xem được đề nháp (họ đang soạn). Học viên chỉ đề đã publish.
        var isManager = User.IsInRole("Admin") || User.IsInRole("ContentManager");
        if (!result.Value.IsPublished && !isManager)
            return Forbid();

        return Ok(new
        {
            token = _tokens.Create(testId),
            expiresInSeconds = (int)MediaTokenService.Lifetime.TotalSeconds
        });
    }

    /// <summary>
    /// GET /api/media/tests/{testId}/audio/ETS26-T01-1.mp3?t=&lt;token&gt;
    ///
    /// [AllowAnonymous] KHÔNG phải mở cửa: thẻ &lt;audio&gt;/&lt;img&gt; do trình duyệt tải
    /// nên không gắn Bearer header được. Bảo vệ chuyển sang verify token trong query.
    /// Vẫn chấp nhận Bearer nếu có (curl/Postman/axios) — tiện cho test và panel CM.
    /// </summary>
    [HttpGet("tests/{testId:Guid}/{subFolder}/{fileName}")]
    [AllowAnonymous]
    public IActionResult GetFile(Guid testId, string subFolder, string fileName, [FromQuery] string? t)
    {
        // Validate(t, testId) — truyền testId để token đề khác bị từ chối (tầng 3)
        var authorized = User.Identity?.IsAuthenticated == true
                      || _tokens.Validate(t, testId);
        if (!authorized) return Unauthorized();

        var fullPath = _paths.ResolveProtectedFile(testId, subFolder, fileName);

        // 404 cho MỌI trường hợp không hợp lệ — không phân biệt "sai path" với
        // "không tồn tại", tránh giúp kẻ tấn công dò cấu trúc thư mục.
        if (fullPath is null) return NotFound();

        if (!ContentTypes.TryGetContentType(fullPath, out var contentType))
            contentType = "application/octet-stream";

        // enableRangeProcessing: BẮT BUỘC cho audio — không có thì không tua được,
        // và Safari trên iOS từ chối phát file không hỗ trợ Range request.
        return PhysicalFile(fullPath, contentType, enableRangeProcessing: true);
    }
}
