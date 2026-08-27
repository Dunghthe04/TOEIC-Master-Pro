using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.API.Extensions;
using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// API cho Dashboard của người học.
///
/// Hiện chỉ có khối "HÔM NAY". Các số liệu tổng quan và biểu đồ vẫn nằm ở
/// <c>/api/test-session/stats/*</c> — không gom về đây, vì chúng đã chạy tốt và gom lại
/// chỉ để "cho gọn" là sửa thứ không hỏng.
/// </summary>
[ApiController]
[Route("api/dashboard")]
// CHỈ User. CM soạn nội dung, Admin quản tài khoản — không vai nào có "việc học hôm nay".
// Chặn ở SERVER chứ không chỉ ẩn menu: gõ thẳng URL cũng phải 403.
[Authorize(Roles = "User")]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _service;
    private readonly ICurrentUserService _currentUser;

    public DashboardController(IDashboardService service, ICurrentUserService currentUser)
    {
        _service = service;
        _currentUser = currentUser;
    }

    /// <summary>
    /// Việc nên làm hôm nay — câu sai cần luyện lại, thẻ từ đến hạn, đã thi tuần này chưa.
    ///
    /// MỘT lượt gọi cho MỘT khối giao diện. Bốn dòng của khối đến từ bốn bảng khác nhau;
    /// để client tự ghép thì thành 4 lượt chờ trước khi người dùng thấy được gì, mà khối
    /// này lại nằm ngay đầu trang.
    /// </summary>
    [HttpGet("today")]
    public async Task<IActionResult> GetToday()
    {
        var userId = RequireUserId();
        if (userId is null) return Unauthorized();

        var result = await _service.GetTodayPlanAsync(userId.Value);
        return result.ToActionResult(this);
    }

    /// <summary>Lấy userId từ JWT. Giống các controller khác của người học.</summary>
    private Guid? RequireUserId() => _currentUser.UserId;
}
