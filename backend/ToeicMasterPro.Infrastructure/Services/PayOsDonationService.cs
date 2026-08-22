using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.Common.Options;
using ToeicMasterPro.Application.DTOs.Donations;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Infrastructure.Services;

/// <summary>
/// Tạo mã QR nhận tiền ủng hộ qua payOS và tra xem đã nhận được tiền chưa.
///
/// KHÔNG LƯU GÌ VÀO DATABASE: payOS đã là sổ ghi chép đầy đủ (mã đơn, số tiền, trạng thái,
/// lịch sử giao dịch), thêm bảng ở đây chỉ tạo ra nguồn sự thật thứ hai phải đồng bộ.
/// Frontend giữ orderCode trong state của popup và hỏi lại trạng thái qua GetStatusAsync.
///
/// KHÔNG DÙNG WEBHOOK dù payOS có: webhook cần một URL công khai để payOS gọi vào, máy dev
/// (localhost) thì không có, nên nó sẽ thành nhánh code chỉ chạy được trên production —
/// tức là không bao giờ test được trước khi deploy. Hỏi trạng thái theo chu kỳ tốn thêm vài
/// request nhưng chạy giống nhau ở mọi môi trường.
/// </summary>
public class PayOsDonationService : IDonationService
{
    private const string HttpClientName = "PayOs";

    // Nội dung chuyển khoản. payOS giới hạn 9 KÝ TỰ nếu tài khoản nhận không liên kết qua
    // payOS, và API trả lỗi chứ không tự cắt bớt — nên giữ ngắn, không dấu.
    private const string PaymentDescription = "Ung ho";

    // payOS trả code "00" cho thành công, mọi mã khác là lỗi nghiệp vụ kèm mô tả ở Desc.
    private const string SuccessCode = "00";

    // payOS nhận và trả JSON camelCase. Đặt policy một lần ở đây thay vì rắc
    // [JsonPropertyName] lên từng field của 4 record bên dưới.
    private static readonly JsonSerializerOptions PayOsJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly PayOsOptions _options;
    private readonly IConfiguration _config;
    private readonly ILogger<PayOsDonationService> _logger;

    public PayOsDonationService(
        IHttpClientFactory httpClientFactory,
        IOptions<PayOsOptions> options,
        IConfiguration config,
        ILogger<PayOsDonationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _config = config;
        _logger = logger;
    }

    public async Task<Result<DonationQrResponse>> CreateQrAsync(int amount)
    {
        if (amount < _options.MinAmount || amount > _options.MaxAmount)
            return Result<DonationQrResponse>.Failure(
                $"Số tiền ủng hộ phải từ {_options.MinAmount:N0}đ đến {_options.MaxAmount:N0}đ.");

        if (!IsConfigured())
            return Result<DonationQrResponse>.Failure("Chức năng ủng hộ chưa được cấu hình.");

        // orderCode phải là số nguyên và DUY NHẤT trong kênh thanh toán. Unix timestamp theo
        // giây vừa đủ duy nhất (một người không bấm tạo QR hai lần trong cùng một giây) vừa
        // cho biết luôn đơn được tạo lúc nào khi đọc log.
        var orderCode = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var expiredAt = DateTimeOffset.UtcNow.AddMinutes(_options.ExpiryMinutes);

        // returnUrl/cancelUrl là BẮT BUỘC với payOS dù luồng của ta không dùng tới: người
        // ủng hộ quét QR ngay trong popup, không rời trang. Chúng chỉ có tác dụng nếu ai đó
        // mở CheckoutUrl — nên trỏ về trang chủ là hợp lý nhất.
        var frontendUrl = _config["Frontend:BaseUrl"] ?? string.Empty;

        var request = new PayOsCreatePaymentRequest(
            OrderCode: orderCode,
            Amount: amount,
            Description: PaymentDescription,
            CancelUrl: frontendUrl,
            ReturnUrl: frontendUrl,
            ExpiredAt: expiredAt.ToUnixTimeSeconds(),
            Signature: CreatePaymentSignature(amount, frontendUrl, PaymentDescription, orderCode, frontendUrl));

        try
        {
            using var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v2/payment-requests")
            {
                Content = JsonContent.Create(request, options: PayOsJson),
            };
            AddAuthHeaders(httpRequest);

            var httpResponse = await _httpClientFactory.CreateClient(HttpClientName).SendAsync(httpRequest);
            var envelope = await httpResponse.Content
                .ReadFromJsonAsync<PayOsEnvelope<PayOsPaymentLink>>(PayOsJson);

            if (envelope?.Code != SuccessCode || envelope.Data is null)
            {
                // Desc của payOS là thông báo dành cho lập trình viên (kể cả khi sai khoá API),
                // không phải câu để đưa lên UI — log lại, trả cho người dùng câu chung chung.
                _logger.LogError(
                    "payOS từ chối tạo link thanh toán: HTTP {StatusCode}, code={Code}, desc={Desc}",
                    (int)httpResponse.StatusCode, envelope?.Code, envelope?.Desc);
                return Result<DonationQrResponse>.Failure("Chưa tạo được mã QR. Vui lòng thử lại sau.");
            }

            var data = envelope.Data;
            return Result<DonationQrResponse>.Success(new DonationQrResponse(
                OrderCode: data.OrderCode,
                Amount: data.Amount,
                QrCode: data.QrCode,
                BankName: string.IsNullOrWhiteSpace(_options.BankName)
                    ? $"Ngân hàng có mã BIN {data.Bin}"
                    : _options.BankName,
                AccountNumber: data.AccountNumber,
                AccountName: data.AccountName,
                // Dùng Description payOS TRẢ VỀ, không phải hằng số gửi lên: payOS thêm tiền tố
                // đối soát của riêng nó, và đó mới là nội dung người chuyển khoản tay phải gõ.
                Description: data.Description,
                CheckoutUrl: data.CheckoutUrl,
                ExpiredAt: data.ExpiredAt is null
                    ? null
                    : DateTimeOffset.FromUnixTimeSeconds(data.ExpiredAt.Value)));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Không gọi được payOS để tạo link thanh toán.");
            return Result<DonationQrResponse>.Failure("Không kết nối được cổng thanh toán. Vui lòng thử lại sau.");
        }
    }

    public async Task<Result<DonationStatusResponse>> GetStatusAsync(long orderCode)
    {
        if (!IsConfigured())
            return Result<DonationStatusResponse>.Failure("Chức năng ủng hộ chưa được cấu hình.");

        try
        {
            using var httpRequest = new HttpRequestMessage(
                HttpMethod.Get, $"/v2/payment-requests/{orderCode}");
            AddAuthHeaders(httpRequest);

            var httpResponse = await _httpClientFactory.CreateClient(HttpClientName).SendAsync(httpRequest);

            if (httpResponse.StatusCode == HttpStatusCode.NotFound)
                return Result<DonationStatusResponse>.NotFound("Không tìm thấy lượt ủng hộ này.");

            var envelope = await httpResponse.Content
                .ReadFromJsonAsync<PayOsEnvelope<PayOsPaymentLinkStatus>>(PayOsJson);

            if (envelope?.Code != SuccessCode || envelope.Data is null)
            {
                _logger.LogWarning(
                    "payOS không trả được trạng thái đơn {OrderCode}: HTTP {StatusCode}, code={Code}, desc={Desc}",
                    orderCode, (int)httpResponse.StatusCode, envelope?.Code, envelope?.Desc);
                return Result<DonationStatusResponse>.Failure("Chưa kiểm tra được trạng thái. Vui lòng thử lại sau.");
            }

            var data = envelope.Data;
            return Result<DonationStatusResponse>.Success(new DonationStatusResponse(
                OrderCode: data.OrderCode,
                Status: data.Status,
                // Căn cứ là AmountPaid > 0, KHÔNG phải Status == "PAID".
                //
                // Người ủng hộ được tự sửa số tiền, nên chuyển ít hơn số điền sẵn trong mã là
                // chuyện thường — khi đó payOS đặt trạng thái UNDERPAID chứ không phải PAID.
                // Nếu chờ đúng "PAID" thì người ủng hộ 10k trên mã gợi ý 20k sẽ không bao giờ
                // thấy lời cảm ơn, dù tiền đã vào tài khoản. Với ủng hộ thì mọi khoản đã nhận
                // đều đáng cảm ơn, không có khái niệm "trả thiếu".
                IsPaid: data.AmountPaid > 0,
                AmountPaid: data.AmountPaid));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Không gọi được payOS để kiểm tra đơn {OrderCode}.", orderCode);
            return Result<DonationStatusResponse>.Failure("Không kết nối được cổng thanh toán. Vui lòng thử lại sau.");
        }
    }

    /// <summary>
    /// Thiếu khoá thì KHÔNG chết lúc khởi động như các cấu hình ở Program.cs: ủng hộ là chức
    /// năng phụ, không ai vì thiếu nó mà nên chặn cả web không lên. Nhưng phải log ở mức Error
    /// để chủ web biết — nếu không thì chỉ có người ủng hộ thấy lỗi, mà họ thì không báo lại.
    /// </summary>
    private bool IsConfigured()
    {
        if (!string.IsNullOrWhiteSpace(_options.ClientId)
            && !string.IsNullOrWhiteSpace(_options.ApiKey)
            && !string.IsNullOrWhiteSpace(_options.ChecksumKey))
            return true;

        _logger.LogError(
            "Thiếu cấu hình payOS. Đặt PayOs:ClientId, PayOs:ApiKey, PayOs:ChecksumKey qua " +
            "user-secrets (dev) hoặc biến môi trường PayOs__ClientId… (prod).");
        return false;
    }

    private void AddAuthHeaders(HttpRequestMessage request)
    {
        request.Headers.Add("x-client-id", _options.ClientId);
        request.Headers.Add("x-api-key", _options.ApiKey);
    }

    /// <summary>
    /// Chữ ký để payOS biết dữ liệu không bị sửa trên đường truyền.
    ///
    /// Chuỗi ký PHẢI đúng năm field này, đúng thứ tự alphabet, giá trị KHÔNG url-encode:
    ///     amount=&amp;cancelUrl=&amp;description=&amp;orderCode=&amp;returnUrl=
    /// Sai một ký tự là payOS trả lỗi chữ ký, không nói sai ở đâu. Lưu ý expiredAt KHÔNG
    /// tham gia chữ ký dù cũng được gửi lên.
    /// </summary>
    private string CreatePaymentSignature(
        int amount, string cancelUrl, string description, long orderCode, string returnUrl)
    {
        var payload = $"amount={amount}&cancelUrl={cancelUrl}&description={description}" +
                      $"&orderCode={orderCode}&returnUrl={returnUrl}";

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.ChecksumKey));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    // ── Khuôn dữ liệu của payOS (chỉ giữ field mình dùng) ──────────────────

    private record PayOsCreatePaymentRequest(
        long OrderCode,
        int Amount,
        string Description,
        string CancelUrl,
        string ReturnUrl,
        long ExpiredAt,
        string Signature
    );

    /// <summary>
    /// Mọi response của payOS đều bọc trong { code, desc, data, signature }. Signature của
    /// response KHÔNG kiểm ở đây: kênh là HTTPS tới thẳng payOS (không qua trung gian nào),
    /// và dữ liệu này chỉ dùng để hiển thị — không có bút toán nào ghi theo nó.
    /// </summary>
    private record PayOsEnvelope<T>(string Code, string Desc, T? Data);

    private record PayOsPaymentLink(
        string Bin,
        string AccountNumber,
        string AccountName,
        int Amount,
        string Description,
        long OrderCode,
        string PaymentLinkId,
        string Status,
        long? ExpiredAt,
        string CheckoutUrl,
        string QrCode
    );

    private record PayOsPaymentLinkStatus(
        string Id,
        long OrderCode,
        int Amount,
        int AmountPaid,
        int AmountRemaining,
        string Status
    );
}
