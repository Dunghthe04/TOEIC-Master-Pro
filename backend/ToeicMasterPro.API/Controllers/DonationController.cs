using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ToeicMasterPro.API.Extensions;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Donations;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DonationController : ControllerBase
{
    private readonly IDonationService _donations;

    public DonationController(IDonationService donations)
    {
        _donations = donations;
    }

    /// <summary>
    /// Tạo mã QR cho một lượt ủng hộ.
    ///
    /// [AllowAnonymous] có chủ ý: khách vãng lai đọc trang giới thiệu và muốn ủng hộ thì
    /// không có lý gì bắt họ tạo tài khoản trước. Đổi lại phải có rate limit, vì mỗi request
    /// ở đây là một link thanh toán thật được tạo bên payOS.
    /// </summary>
    [HttpPost("qr")]
    [AllowAnonymous]
    [EnableRateLimiting("donate")]
    public async Task<IActionResult> CreateQr(CreateDonationQrRequest req)
    {
        var result = await _donations.CreateQrAsync(req.Amount);
        return result.ToActionResult(this);
    }

    /// <summary>
    /// Trạng thái một lượt ủng hộ — popup gọi lại theo chu kỳ trong lúc chờ chuyển khoản.
    ///
    /// orderCode KHÔNG phải bí mật cần bảo vệ: nó chỉ tiết lộ số tiền của đúng lượt ủng hộ
    /// mà người gọi vừa tự tạo, và người ủng hộ ẩn danh nên không có danh tính nào để lộ.
    /// </summary>
    [HttpGet("{orderCode:long}/status")]
    [AllowAnonymous]
    [EnableRateLimiting("donate-status")]
    public async Task<IActionResult> GetStatus(long orderCode)
    {
        var result = await _donations.GetStatusAsync(orderCode);
        return result.ToActionResult(this);
    }
}
