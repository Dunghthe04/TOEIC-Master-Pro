using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.Infrastructure.Services;

/// <summary>
/// Ghi AuditLog vào DB. Xem IAuditLogger cho nguyên tắc thiết kế.
///
/// ⚠️ DÙNG DbContext RIÊNG (qua IServiceScopeFactory), KHÔNG dùng chung với chỗ gọi.
///
/// Vì sao: bản đầu tiên inject thẳng ApplicationDbContext — cùng một instance scoped với
/// AuthService. Khi ghi log lỗi (bảng chưa tồn tại vì chưa chạy migration), try/catch ở
/// đây bắt được exception và bỏ qua đúng như thiết kế, NHƯNG entity AuditLog vẫn nằm
/// trong ChangeTracker của DbContext dùng chung. Lần SaveChangesAsync tiếp theo của
/// NGHIỆP VỤ CHÍNH (BuildAuthResponseAsync lưu refresh token) lại cố ghi nó và nổ ở đó
/// → đăng nhập chết, đúng cái mà try/catch tưởng đã ngăn được.
///
/// Bài học: try/catch quanh SaveChanges KHÔNG cách ly được lỗi nếu DbContext dùng chung —
/// ChangeTracker giữ entity lỗi lại và lây sang mọi SaveChanges sau đó. Muốn cách ly thật
/// thì phải cách ly DbContext.
/// </summary>
public class AuditLogger : IAuditLogger
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ICurrentUserService _currentUser;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<AuditLogger> _logger;

    public AuditLogger(
        IServiceScopeFactory scopeFactory,
        ICurrentUserService currentUser,
        IHttpContextAccessor http,
        ILogger<AuditLogger> logger)
    {
        _scopeFactory = scopeFactory;
        _currentUser = currentUser;
        _http = http;
        _logger = logger;
    }

    public async Task LogAsync(
        AuditCategory category,
        string action,
        string targetType,
        Guid? targetId,
        string targetLabel,
        string? detail = null,
        string? actorEmailOverride = null,
        CancellationToken ct = default)
    {
        try
        {
            var entry = new AuditLog
            {
                Category = category,
                ActorId = _currentUser.UserId,
                // Ưu tiên override: đăng nhập thất bại thì chưa có ai đăng nhập, nhưng
                // vẫn cần biết email nào đang bị dò. "(không rõ)" cho trường hợp không
                // có cả hai — cột NOT NULL nên không để rỗng.
                ActorEmail = Truncate(actorEmailOverride ?? _currentUser.Email ?? "(không rõ)", 256),
                Action = Truncate(action, 64),
                TargetType = Truncate(targetType, 32),
                TargetId = targetId,
                TargetLabel = Truncate(targetLabel, 256),
                Detail = detail is null ? null : Truncate(detail, 1000),
                IpAddress = ResolveIpAddress(),
            };

            // Scope riêng → DbContext riêng → ChangeTracker riêng. Entity này không bao
            // giờ lẫn vào DbContext mà nghiệp vụ chính đang dùng.
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.AuditLogs.Add(entry);
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // KHÔNG ném lại. Ghi log là việc PHỤ — để exception bay ra là biến "DB chậm
            // lúc ghi log" thành "không đăng nhập được" hoặc "không khoá được tài khoản".
            // Nghiệp vụ chính phải chạy xong dù nhật ký có mất một dòng.
            //
            // Ghi vào ILogger để bản thân việc mất log cũng để lại dấu vết ở đâu đó.
            _logger.LogError(ex,
                "Không ghi được AuditLog — Action={Action}, TargetId={TargetId}",
                action, targetId);
        }
    }

    /// <summary>
    /// IP người gọi.
    ///
    /// ⚠️ RemoteIpAddress chỉ đúng khi client nối TRỰC TIẾP tới Kestrel. Sau reverse
    /// proxy (Nginx ở Phase 3) thì nó là IP của proxy — tức 127.0.0.1 cho MỌI request,
    /// và cột IP thành vô dụng. Vì vậy Program.cs phải bật UseForwardedHeaders để
    /// ASP.NET đọc X-Forwarded-For và thay RemoteIpAddress bằng IP thật.
    /// Ở đây chỉ đọc RemoteIpAddress — KHÔNG tự parse X-Forwarded-For, vì header đó do
    /// client gửi nên giả mạo được; chỉ middleware (biết proxy nào đáng tin) mới xử lý đúng.
    /// </summary>
    private string? ResolveIpAddress()
    {
        var ip = _http.HttpContext?.Connection.RemoteIpAddress;
        if (ip is null) return null;

        // IPv4-mapped IPv6 ("::ffff:192.168.1.5") → về dạng IPv4 cho dễ đọc.
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();
        return ip.ToString();
    }

    /// <summary>
    /// Cắt cho khớp HasMaxLength. Không cắt thì chuỗi dài hơn cột làm SaveChanges ném
    /// "String or binary data would be truncated" — và vì đã bọc try/catch ở trên, hậu quả
    /// là log âm thầm không được ghi, khó phát hiện.
    /// </summary>
    private static string Truncate(string value, int max)
        => value.Length <= max ? value : value[..max];
}
