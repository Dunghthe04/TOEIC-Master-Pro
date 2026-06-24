using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Authentication;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext context,
        ITokenService tokenService)
    {
        _userManager = userManager;
        _context = context;
        _tokenService = tokenService;
    }

     public async Task<Result> RegisterAsync(RegisterRequest req)
    {
        var existing = await _userManager.FindByEmailAsync(req.Email);
        if (existing is not null)
            return Result.Failure("Email đã được sử dụng.");

        var user = new ApplicationUser
        {
            UserName = req.Email,
            Email = req.Email,
            FullName = req.FullName
        };

        var createResult = await _userManager.CreateAsync(user, req.Password);
        if (!createResult.Succeeded)
            return Result.Failure(string.Join("; ", createResult.Errors.Select(e => e.Description)));

        await _userManager.AddToRoleAsync(user, "User");

        var emailToken = await _userManager.GenerateEmailConfirmationTokenAsync(user);
        Console.WriteLine($"[EMAIL VERIFY] userId = {user.Id}");
        Console.WriteLine($"[EMAIL VERIFY] token  = {emailToken}");

        return Result.Success();
    }

     public async Task<Result<AuthResponse>> LoginAsync(LoginRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user is null)
            return Result<AuthResponse>.Failure("Email hoặc mật khẩu không đúng.");

        var passwordOk = await _userManager.CheckPasswordAsync(user, req.Password);
        if (!passwordOk)
            return Result<AuthResponse>.Failure("Email hoặc mật khẩu không đúng.");

        var response = await BuildAuthResponseAsync(user);
        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken)
    {
        var stored= await _context.RefreshTokens
        .Include(rt=> rt.User)
        .FirstOrDefaultAsync(rt=> rt.Token==refreshToken);

        if(stored is null || !stored.IsActive)
            return Result<AuthResponse>.Failure("Refresh token không hợp lệ hoặc đã hết hạn.");

        //Thu hoi token cu
        stored.RevokedAt= DateTime.UtcNow;
        var response = await BuildAuthResponseAsync(stored.User);
        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result> LogoutAsync(string refreshToken)
    {
        var stored = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (stored is not null && stored.IsActive)
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        return Result.Success();
    }

    public async Task<Result> ConfirmEmailAsync(Guid userId, string token)
    {
        var user = await _userManager.FindByIdAsync(userId.ToString());
        if (user is null)
            return Result.Failure("Người dùng không tồn tại.");

        var result = await _userManager.ConfirmEmailAsync(user, token);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure("Xác thực email thất bại.");
    }

    // ── Helper dùng chung cho Login & Refresh ──
    private async Task<AuthResponse> BuildAuthResponseAsync(ApplicationUser user)
    {
        var roles = await _userManager.GetRolesAsync(user);
        var accessToken = _tokenService.GenerateAccessToken(user, roles);
        var refresh = _tokenService.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refresh);
        await _context.SaveChangesAsync();   // lưu refresh token mới (và revoke cũ nếu có)

        return new AuthResponse(accessToken, refresh.Token, refresh.ExpiresAt);
    }


}