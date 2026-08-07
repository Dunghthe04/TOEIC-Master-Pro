using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.API.Extensions;


namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/auth")]
[EnableRateLimiting("auth")]
[AllowAnonymous]
public class AuthController : ControllerBase{
    private IAuthService _auth;
    public AuthController(IAuthService auth){
        _auth=auth;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req)
    {
        var result = await _auth.RegisterAsync(req);
        return result.IsSuccess
            ? Ok(new { message = "Đăng ký thành công. Xem console để lấy token xác thực email." })
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

    [HttpPost("refresh-token")]
    public async Task<IActionResult> Refresh(RefreshTokenRequest req)
    {
        //Đọc từ cookie - k nhận refresh token từ body JSON nữa, vì refresh token là sensitive data, k muốn FE đọc được
        //Trình duyệt tự động đính kèm cookie này vì Path="/api/auth" khớp.
        var refreshToken = Request.GetRefreshTokenCookie();
        if(refreshToken == null) return Unauthorized(new { error = "Không tìm thấy refresh token." });

        var result = await _auth.RefreshTokenAsync(refreshToken);
        if(!result.IsSuccess) return Unauthorized(new { error = result.Error });

        //Cookie rotate: xóa cookie cũ, set cookie mới
        Response.SetRefreshTokenCookie(result.Value!.RefreshToken, result.Value.ExpiresAt);
        return Ok(new { accessToken = result.Value.AccessToken, expiresAt = result.Value.ExpiresAt });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshTokenRequest req)
    {
       var refreshToken = Request.GetRefreshTokenCookie();
       if(refreshToken is not null) 
            await _auth.LogoutAsync(refreshToken);
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