namespace ToeicMasterPro.API.Extensions;
/// <summary>
/// Một chỗ duy nhất quyết định cookie refresh token có thuộc tính gì.
///
/// VÌ SAO HTTPONLY: XSS (dù đã sanitize ở lỗi #4, phòng khi vẫn lọt) đọc được
/// mọi thứ trong localStorage bằng document.cookie / localStorage.getItem — TRỪ
/// cookie có cờ HttpOnly. Trình duyệt chặn JavaScript đọc cookie đó ở tầng engine,
/// không phải ở tầng ứng dụng.
///
/// VÌ SAO SAMESITE=STRICT: chặn CSRF — cookie chỉ được trình duyệt gửi kèm khi
/// request xuất phát TỪ CHÍNH domain này, không gửi khi một trang độc hại khác
/// dụ user bấm link/submit form tới API của mình.
///
/// ⚠️ Nếu FE và BE khác domain khi deploy (vd app.x.com gọi api.x.com) thì phải
/// đổi thành SameSite=None (bắt buộc kèm Secure=true, chỉ chạy được qua HTTPS) —
/// Strict sẽ chặn luôn cookie ở request cross-site dù cùng là "của mình".
/// </summary>
public static class CookieAuthExtenstions
{
    //Tên cookie refresh token, dùng để set và get cookie trong request/response.
    private const string CookieName = "refreshToken";

    //Hàm tiện ích set cookie refresh token vào response, dùng trong AuthController/RefreshToken.
    public static void SetRefreshTokenCookie(this HttpResponse response, string token, DateTime expiresAt)
    {
        WarnIfCookieWillBeDropped(response.HttpContext);

        response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,//Chặn JavaScript đọc cookie này, chỉ trình duyệt mới gửi kèm request.
            SameSite = SameSiteMode.Strict,//Chặn CSRF, cookie chỉ gửi kèm request xuất phát từ domain này.
            Expires = expiresAt,//Thời điểm cookie hết hạn, trùng với thời điểm refresh token hết hạn.
            Secure = true,//Chỉ gửi cookie qua HTTPS, chặn HTTP.
            Path = "/api/auth"// chỉ gửi cookie này cho nhóm endpoint auth, không phải mọi request
        });
    }

    //Hàm xóa cookie refresh token khỏi response 
    public static void ClearRefreshTokenCookie(this HttpResponse response)
    {
        response.Cookies.Delete(CookieName, new CookieOptions
        {
            Path = "/api/auth",//chỉ xóa cookie này cho nhóm endpoint auth, không phải mọi request
        });
    }

    public static string? GetRefreshTokenCookie(this HttpRequest request)
    {
        return request.Cookies[CookieName];
    }

    /// <summary>
    /// Cảnh báo khi cookie Secure=true được set trên một origin HTTP mà browser KHÔNG
    /// miễn trừ — khi đó browser lặng lẽ bỏ cookie: không lỗi, không log, không dấu hiệu.
    ///
    /// Triệu chứng gây nhầm lẫn: đăng nhập thành công (200, có access token), nhưng F5
    /// là mất phiên vì cookie chưa từng được lưu. Y hệt triệu chứng của SameSite chặn
    /// cookie, nên rất dễ đi sai hướng khi truy lỗi.
    ///
    /// localhost/127.0.0.1 KHÔNG cảnh báo: spec Secure Contexts coi đây là "potentially
    /// trustworthy origin" nên Chrome/Firefox vẫn nhận cookie Secure qua HTTP (Safari
    /// thì không — nếu dev bằng Safari thì phải chạy HTTPS).
    /// </summary>
    private static void WarnIfCookieWillBeDropped(HttpContext http)
    {
        if (http.Request.IsHttps) return;

        var host = http.Request.Host.Host;
        if (host is "localhost" or "127.0.0.1" or "[::1]" or "::1") return;

        http.RequestServices
            .GetService<ILoggerFactory>()
            ?.CreateLogger(typeof(CookieAuthExtenstions))
            .LogWarning(
                "Cookie '{CookieName}' có Secure=true nhưng request đến qua HTTP trên host " +
                "'{Host}' (không phải localhost) — browser sẽ BỎ cookie này mà không báo lỗi. " +
                "Hệ quả: đăng nhập được nhưng F5 là mất phiên. Chạy qua HTTPS, hoặc để reverse " +
                "proxy chuyển tiếp HTTPS kèm X-Forwarded-Proto.",
                CookieName, host);
    }
}