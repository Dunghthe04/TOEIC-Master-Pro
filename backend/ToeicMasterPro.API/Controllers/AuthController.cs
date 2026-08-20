using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.API.Extensions;


namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/auth")]
// Mặc định SIẾT: mọi endpoint trong controller này chịu "auth" (5 req/phút/IP).
// Endpoint nào cần rộng hơn phải NÓI RA bằng [EnableRateLimiting] riêng ở action —
// giữ đúng hướng fail-closed: quên đánh dấu thì bị siết, không phải bị mở toang.
[EnableRateLimiting("auth")]
[AllowAnonymous]
public class AuthController : ControllerBase{
    private IAuthService _auth;
    private readonly ICurrentUserService _currentUser;
    public AuthController(IAuthService auth, ICurrentUserService currentUser){
        _auth=auth;
        _currentUser = currentUser;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        // Thông báo PHẢI trung tính: RegisterAsync giờ trả Success cho cả trường hợp
        // email đã có tài khoản (chống user enumeration), nên câu "Đăng ký thành công"
        // sẽ là nói dối ở nhánh đó. Cùng khuôn với forgot-password bên dưới.
        // (Câu cũ còn nói "Xem console để lấy token" — lỗi thời từ khi gửi mail thật.)
        return result.IsSuccess
            ? Ok(new { message = "Nếu email chưa được sử dụng, link xác nhận đã được gửi. Vui lòng kiểm tra hộp thư." })
            : BadRequest(new { error = result.Error });
    }

    [HttpPost("login")]
    public async Task<IActionResult>Login(LoginRequest req){
        var result= await _auth.LoginAsync(req);
        if(!result.IsSuccess) return BadRequest(new {error = result.Error});

        //refreshToken đi qua httpOnly cookie, không còn trong body JSON 
        //Js bên Fe sẽ k thấy giá trị này
        Response.SetRefreshTokenCookie(result.Value!.RefreshToken, result.Value.ExpiresAt);
        // accessToken vẫn trả trong body: FE PHẢI đọc được để gắn vào header
        // Authorization — đây là lý do access token không thể cũng là cookie.
        return Ok(new { accessToken = result.Value.AccessToken, expiresAt = result.Value.ExpiresAt });

    }

    // Đè policy cấp class: attribute ở action được ưu tiên hơn ở controller.
    // Không có dòng này thì mỗi lần F5 trang là ăn quota chung với login → 429.
    [HttpPost("refresh-token")]
    [EnableRateLimiting("auth-refresh")]
    public async Task<IActionResult> Refresh()
    {
        // KHÔNG nhận body: refresh token đọc từ cookie httpOnly (Path=/api/auth khớp nên
        // trình duyệt tự đính kèm). Trước đây để tham số RefreshTokenRequest → [ApiController]
        // bắt buộc field RefreshToken trong body → FE gửi body rỗng {} bị 400 trước khi vào hàm.
        var refreshToken = Request.GetRefreshTokenCookie();
        if(refreshToken == null) return Unauthorized(new { error = "Không tìm thấy refresh token." });

        var result = await _auth.RefreshTokenAsync(refreshToken);
        if(!result.IsSuccess) return Unauthorized(new { error = result.Error });

        //Cookie rotate: xóa cookie cũ, set cookie mới
        Response.SetRefreshTokenCookie(result.Value!.RefreshToken, result.Value.ExpiresAt);
        return Ok(new { accessToken = result.Value.AccessToken, expiresAt = result.Value.ExpiresAt });
    }

    // Logout bị 429 thì user KHÔNG đăng xuất được — refresh token sống tiếp trong DB.
    // Đây là hạn mức làm giảm an toàn chứ không tăng, nên nới cùng nhóm với refresh.
    //
    // [Authorize] đè lại [AllowAnonymous] cấp class — bắt buộc có Bearer accessToken
    // hợp lệ mới gọi được, để LogoutAsync biết ĐÚNG userId nào đang gọi (kiểm quyền
    // sở hữu refreshToken, xem AuthService.LogoutAsync). FE vẫn hoạt động bình thường
    // không cần sửa gì: axios luôn gắn kèm Bearer accessToken hiện có trong lúc gọi
    // logout (state chỉ bị xóa ở finally, SAU khi gọi API xong).
    [HttpPost("logout")]
    [Authorize]
    [EnableRateLimiting("auth-refresh")]
    public async Task<IActionResult> Logout()
    {
       var userId = _currentUser.UserId;
       // Không thể null khi đã qua [Authorize] với JWT do chính hệ thống cấp (luôn
       // có claim Sub) — nhưng vẫn kiểm để không NullReferenceException nếu có gì
       // bất thường (VD JWT hợp lệ nhưng thiếu claim do sửa TokenService sai).
       if (userId is null)
            return Unauthorized();

       // Cũng đọc từ cookie, không cần body — bỏ tham số để không dính 400 như Refresh().
       var refreshToken = Request.GetRefreshTokenCookie();
       if(refreshToken is not null)
            await _auth.LogoutAsync(userId.Value, refreshToken);
       Response.ClearRefreshTokenCookie();
       return Ok(new { message = "Đăng xuất thành công." });
    }

    [HttpGet("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromQuery] Guid userId, [FromQuery] string token)
    {
        var result = await _auth.ConfirmEmailAsync(userId, token);
        return result.IsSuccess
            ? Ok(new { message = "Xác thực email thành công." })
            : BadRequest(new { error = result.Error });
    }

    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest req){
        await _auth.ForgotPasswordAsync(req);
        return Ok(new { message = "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi." });
    }
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest req){
        var result = await _auth.ResetPasswordAsync(req);
        return result.IsSuccess
            ? Ok(new { message = "Đặt lại mật khẩu thành công." })
            : BadRequest(new { error = result.Error });
    }
    //Khi đăng nhập bằng gg ==> gg cấp IdToken vào frontend
    //Frontend gửi IdToken cho backend
    //Backend xác thực IdToken với Google và trả về AccessToken, RefreshToken, ExpiresAt
    [HttpPost("google-login")]
    public async Task<IActionResult> GoogleLogin(GoogleLoginRequest req){
        var result= await _auth.GoogleLoginAsync(req.IdToken);
        if(!result.IsSuccess) return BadRequest(new {error = result.Error});
        Response.SetRefreshTokenCookie(result.Value!.RefreshToken, result.Value.ExpiresAt);
        return Ok(new { accessToken = result.Value.AccessToken, expiresAt = result.Value.ExpiresAt });
    }
}