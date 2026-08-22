namespace ToeicMasterPro.Application.Common.Options;

/// <summary>
/// Bind từ appsettings section "PayOs". Ba khoá lấy ở my.payos.vn → Kênh thanh toán.
///
/// ⚠️ KHÔNG điền giá trị thật vào appsettings.json (file này nằm trong git):
///   Development → dotnet user-secrets set "PayOs:ClientId" "..."
///   Production  → biến môi trường PayOs__ClientId / PayOs__ApiKey / PayOs__ChecksumKey
/// </summary>
public class PayOsOptions
{
    public const string SectionName = "PayOs";

    public string BaseUrl { get; set; } = "https://api-merchant.payos.vn";
    public string ClientId { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string ChecksumKey { get; set; } = string.Empty;

    /// <summary>
    /// Tên ngân hàng nhận tiền, hiện cạnh số tài khoản cho người không quét được QR.
    ///
    /// Phải tự điền vì payOS chỉ trả về mã BIN (vd "970422") chứ không trả tên — mà biết số
    /// tài khoản nhưng không biết ngân hàng nào thì vẫn không chuyển khoản tay được. Để
    /// trống thì hiện mã BIN, đúng nhưng khó hiểu với người chuyển tiền.
    /// </summary>
    public string BankName { get; set; } = string.Empty;

    /// <summary>
    /// Chặn hai đầu cho số tiền client gửi lên: số quá nhỏ thì phí giao dịch ăn hết phần ủng
    /// hộ, số quá lớn thường là gõ thừa số 0 — mà người ủng hộ chỉ phát hiện ra sau khi tiền
    /// đã chuyển.
    /// </summary>
    public int MinAmount { get; set; } = 10_000;
    public int MaxAmount { get; set; } = 10_000_000;

    /// <summary>
    /// Link thanh toán tự hết hạn sau bao nhiêu phút. Đủ dài để mở app ngân hàng và quét,
    /// đủ ngắn để mã QR chụp lại được không còn dùng được về sau.
    /// </summary>
    public int ExpiryMinutes { get; set; } = 15;
}
