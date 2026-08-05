using Hangfire.Dashboard;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;


namespace ToeicMasterPro.API.Authorization;

/// <summary>
/// Chặn truy cập Hangfire Dashboard.
///
/// VÌ SAO PHẢI TỰ VIẾT:
/// UseHangfireDashboard là middleware TERMINAL — nó khớp đường dẫn rồi tự trả response,
/// không đi qua routing nên KHÔNG có endpoint metadata. Fallback policy đặt trong
/// UseAuthorization chỉ áp lên endpoint, nên nó hoàn toàn vô hình với /hangfire.
///
/// VÌ SAO KHÔNG DÙNG MẶC ĐỊNH CỦA HANGFIRE:
/// LocalRequestsOnlyAuthorizationFilter chỉ cho request từ localhost. Sau reverse proxy
/// (Nginx → http://api:8080) thì MỌI request đều đến từ mạng nội bộ Docker → trông như
/// local → cho qua hết. Phải xác thực theo DANH TÍNH, không theo địa chỉ IP.
///
/// VÌ SAO BASIC AUTH MÀ KHÔNG DÙNG JWT:
/// Dashboard là trang HTML mở bằng trình duyệt. Access token của app nằm trong
/// localStorage nên trình duyệt không tự gắn Authorization header → User luôn ẩn danh.
/// Basic Auth qua HTTPS là cách gọn nhất cho một trang quản trị nội bộ.
/// </summary>
public class HangfireDashboardAuthFilter : IDashboardAuthorizationFilter
{
    private readonly string _user;
    private readonly string _password;

    public HangfireDashboardAuthFilter(string user, string password)
    {
        _user = user;
        _password = password;
    }

    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();

        // Đã đăng nhập bằng JWT và có role Admin thì cho qua luôn —
        // trường hợp gọi bằng curl/Postman có kèm Bearer token.
        if (http.User.Identity?.IsAuthenticated == true && http.User.IsInRole("Admin"))
            return true;

        if (TryBasicAuth(http)) return true;

        // Trả 401 kèm WWW-Authenticate để trình duyệt HIỆN HỘP ĐĂNG NHẬP.
        // Không có header này thì người dùng chỉ thấy trang trắng, không biết cần làm gì.
        http.Response.StatusCode = StatusCodes.Status401Unauthorized;
        http.Response.Headers["WWW-Authenticate"] = "Basic realm=\"Hangfire Dashboard\"";
        return false;
    }

    private bool TryBasicAuth(HttpContext http)
    {
        var raw = http.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(raw)) return false;

        if (!AuthenticationHeaderValue.TryParse(raw, out var header)
            || !"Basic".Equals(header.Scheme, StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(header.Parameter))
            return false;

        string decoded;
        try
        {
            decoded = Encoding.UTF8.GetString(Convert.FromBase64String(header.Parameter));
        }
        catch (FormatException)
        {
            return false;   // header rác — không để nó thành 500
        }

        var sep = decoded.IndexOf(':');
        if (sep < 0) return false;

        var user = decoded[..sep];
        var password = decoded[(sep + 1)..];

        // So sánh theo THỜI GIAN HẰNG SỐ (fixed-time). So sánh chuỗi thường thoát sớm
        // ở ký tự khác đầu tiên → thời gian phản hồi tiết lộ độ dài prefix đúng,
        // cho phép dò mật khẩu từng ký tự (timing attack).
        return CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(user), Encoding.UTF8.GetBytes(_user))
             & CryptographicOperations.FixedTimeEquals(
                   Encoding.UTF8.GetBytes(password), Encoding.UTF8.GetBytes(_password));
    }
}
