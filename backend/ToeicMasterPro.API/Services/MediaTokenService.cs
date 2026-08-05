using System.Security.Cryptography;
using System.Text;

namespace ToeicMasterPro.API.Services;

/// <summary>
/// Sinh/verify token ngắn hạn cho URL media.
///
/// VÌ SAO CẦN: thẻ &lt;audio&gt;/&lt;img&gt; do TRÌNH DUYỆT tải, không qua axios nên không
/// gắn được Authorization header → 401. Token buộc phải nằm trong URL.
///
/// VÌ SAO KHÔNG DÙNG LUÔN ACCESS TOKEN TRONG QUERY:
/// URL bị ghi vào access log Nginx, header Referer, history trình duyệt, cache CDN.
/// Access token lộ = chiếm tài khoản. Token này chỉ đọc media CỦA MỘT ĐỀ, sống 10 phút.
/// Least privilege.
///
/// VÌ SAO KÝ THEO testId (không phải token dùng chung):
/// Token chung cho phép học viên đang thi đề 1 tải media của đề 2 — kể cả đề nháp
/// chưa publish, vì tên file có quy luật (ETS26-T02-1.mp3). Ký testId vào chữ ký
/// làm token chỉ dùng được cho đúng đề đã cấp.
///
/// KHÔNG LƯU DB: HMAC cho phép verify bằng cách tính lại chữ ký từ nội dung + secret.
/// Không state, không bảng token, không cần job dọn token hết hạn.
///
/// Định dạng: {testId}.{expiryUnix}.{base64url(HMAC-SHA256("{testId}:{expiryUnix}"))}
/// </summary>
public class MediaTokenService
{
    private readonly byte[] _key;

    /// <summary>
    /// 10 phút: đủ để tải audio một Part, ngắn để URL lộ không thiệt hại lâu.
    /// FE tự xin token mới khi gần hết hạn (còn 60s).
    /// </summary>
    public static TimeSpan Lifetime => TimeSpan.FromMinutes(10);

    public MediaTokenService(IConfiguration config)
    {
        // Dùng chung Jwt:SecretKey — đã được fail-fast kiểm >= 32 byte ở Program.cs.
        // Không thêm secret mới để người deploy không phải cấu hình thêm biến môi trường.
        var secret = config["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("Thiếu 'Jwt:SecretKey' cho MediaTokenService.");
        _key = Encoding.UTF8.GetBytes(secret);
    }

    public string Create(Guid testId)
    {
        var expiry = DateTimeOffset.UtcNow.Add(Lifetime).ToUnixTimeSeconds();
        return $"{testId}.{expiry}.{Sign(testId, expiry)}";
    }

    /// <summary>
    /// Verify token có phải do server này cấp, còn hạn, và cấp cho ĐÚNG testId này.
    /// </summary>
    public bool Validate(string? token, Guid expectedTestId)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;

        var parts = token.Split('.');
        if (parts.Length != 3) return false;

        // Token cấp cho đề khác → từ chối. Đây là tầng chống dump media đề khác.
        if (!Guid.TryParse(parts[0], out var testId) || testId != expectedTestId) return false;

        if (!long.TryParse(parts[1], out var expiry)) return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expiry) return false;

        // FixedTimeEquals: so sánh chuỗi thường THOÁT SỚM ở ký tự khác đầu tiên →
        // thời gian phản hồi tiết lộ độ dài prefix đúng, cho phép dò chữ ký từng ký tự
        // (timing attack). Hàm này luôn chạy hết mọi byte.
        var expected = Encoding.UTF8.GetBytes(Sign(testId, expiry));
        var actual = Encoding.UTF8.GetBytes(parts[2]);
        return expected.Length == actual.Length
            && CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private string Sign(Guid testId, long expiry)
    {
        using var hmac = new HMACSHA256(_key);
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes($"{testId}:{expiry}"));
        // base64url: thay +/ và bỏ = để an toàn trong query string
        return Convert.ToBase64String(hash)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}
