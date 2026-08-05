namespace ToeicMasterPro.API.Services;

/// <summary>
/// Nguồn sự thật duy nhất về NƠI LƯU media.
///
/// Tách hai loại vì UseStaticFiles là middleware TERMINAL — khớp đường dẫn là trả file
/// rồi dừng pipeline, KHÔNG tham gia authorization. Đổi thứ tự middleware không cứu được;
/// cách duy nhất là để file cần bảo vệ NGOÀI wwwroot.
/// </summary>
public class MediaPathProvider
{
    private readonly IWebHostEnvironment _env;

    public MediaPathProvider(IWebHostEnvironment env) => _env = env;

    /// <summary>wwwroot — công khai qua UseStaticFiles. Chỉ dùng cho avatar.</summary>
    public string PublicRoot => _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");

    /// <summary>
    /// Ngoài wwwroot — chỉ serve được qua MediaFileController có [Authorize].
    /// Trên VPS đây là mount point của volume `media` (docker-compose.prod.yml).
    /// </summary>
    public string ProtectedRoot => Path.Combine(_env.ContentRootPath, "protected-media");

    public string TestAudioFolder(Guid testId)
        => Path.Combine(ProtectedRoot, "tests", testId.ToString(), "audio");

    public string TestImageFolder(Guid testId)
        => Path.Combine(ProtectedRoot, "tests", testId.ToString(), "images");

    /// <summary>
    /// URL cho client. Đường dẫn /api/media/tests/... đi qua controller nên CÓ authorization,
    /// khác /uploads/... đi qua UseStaticFiles nên KHÔNG có.
    /// </summary>
    public static string TestMediaUrl(Guid testId, string subFolder, string fileName)
        => $"/api/media/tests/{testId}/{subFolder}/{fileName}";

    /// <summary>
    /// Chống path traversal: chặn ../, tên tuyệt đối, và mọi thứ ra ngoài ProtectedRoot.
    /// Trả null nếu không hợp lệ — caller phải trả 404, KHÔNG trả 400 kèm lý do
    /// (tránh giúp kẻ tấn công dò cấu trúc thư mục).
    /// </summary>
    public string? ResolveProtectedFile(Guid testId, string subFolder, string fileName)
    {
        if (subFolder is not ("audio" or "images")) return null;
        if (string.IsNullOrWhiteSpace(fileName)) return null;

        // Path.GetFileName cắt mọi thành phần thư mục — "../../appsettings.json" → "appsettings.json"
        var safeName = Path.GetFileName(fileName);
        if (safeName != fileName) return null;

        var folder = subFolder == "audio" ? TestAudioFolder(testId) : TestImageFolder(testId);
        var fullPath = Path.GetFullPath(Path.Combine(folder, safeName));

        // Kiểm tra lần hai sau khi normalize — phòng trường hợp ký tự lạ vượt qua bước trên
        if (!fullPath.StartsWith(Path.GetFullPath(ProtectedRoot), StringComparison.OrdinalIgnoreCase))
            return null;

        return File.Exists(fullPath) ? fullPath : null;
    }
}
