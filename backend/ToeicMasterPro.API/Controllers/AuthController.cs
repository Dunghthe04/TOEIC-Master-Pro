using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Auth;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/auth")]
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
        return result.IsSuccess 
            ? Ok(result.Value)
            : BadRequest(new {error = result.Error});
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> Refresh(RefreshTokenRequest req)
    {
        var result = await _auth.RefreshTokenAsync(req.RefreshToken);
        return result.IsSuccess
            ? Ok(result.Value)
            : Unauthorized(new { error = result.Error });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout(RefreshTokenRequest req)
    {
        await _auth.LogoutAsync(req.RefreshToken);
        return Ok(new { message = "Đã đăng xuất." });
    }

    [HttpGet("confirm-email")]
    public async Task<IActionResult> ConfirmEmail([FromQuery] Guid userId, [FromQuery] string token)
    {
        var result = await _auth.ConfirmEmailAsync(userId, token);
        return result.IsSuccess
            ? Ok(new { message = "Xác thực email thành công." })
            : BadRequest(new { error = result.Error });
    }
}