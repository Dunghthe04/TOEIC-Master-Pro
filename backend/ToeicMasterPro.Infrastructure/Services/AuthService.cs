using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Authentication;
using ToeicMasterPro.Infrastructure.Persistence;
using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace ToeicMasterPro.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly GoogleAuthSettings _googleSettings;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext context,
        ITokenService tokenService,
        IOptions<GoogleAuthSettings> googleSettings)
    {
        _userManager = userManager;
        _context = context;
        _tokenService = tokenService;
        _googleSettings = googleSettings.Value;
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
        var stored = await _context.RefreshTokens
        .Include(rt => rt.User)
        .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

        if (stored is null || !stored.IsActive)
            return Result<AuthResponse>.Failure("Refresh token không hợp lệ hoặc đã hết hạn.");

        //Thu hoi token cu
        stored.RevokedAt = DateTime.UtcNow;
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

    public async Task<Result> ForgotPasswordAsync(ForgotPasswordRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);

        // Bảo mật: KHÔNG tiết lộ email có tồn tại hay không.
        // Có user thì mới sinh token; không thì vẫn trả Success bình thường.
        if (user is not null)
        {
            //ASP.NET Identity tạo một token đặc biệt để reset mật khẩu. chỉ dùng cho reset mật khẩu
            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            Console.WriteLine($"[RESET PASSWORD] email = {user.Email}");
            Console.WriteLine($"[RESET PASSWORD] token = {resetToken}");
        }
        return Result.Success();
    }
    public async Task<Result> ResetPasswordAsync(ResetPasswordRequest req)
    {
        //Tìm user
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user is null)
            return Result.Failure("Token hoặc email không hợp lệ");
        var result = await _userManager.ResetPasswordAsync(user, req.Token, req.NewPassword);
        if (!result.Succeeded)
        {
            return Result.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));
        }
        // Bảo mật: đổi mật khẩu xong → thu hồi mọi refresh token đang hoạt động
        // → buộc đăng nhập lại trên mọi thiết bị (phòng trường hợp bị chiếm tài khoản).
        var activeTokens = await _context.RefreshTokens
                            .Where(rt => rt.UserId == user.Id && rt.RevokedAt == null)
                            .ToListAsync();
        foreach (var t in activeTokens)
        {
            t.RevokedAt = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync();
        return Result.Success();
    }

    //Khi Fe chọn đăng nhập bằng gg
    //gg cấp 1 jwt gồm nhiều thông tin
    //idToken (JWT) = {email: "...", name: "...", aud: "164202546206-...apps.googleusercontent.com", signature: "..."}
    //aud chính là id cho project -> so sánh aud với mã set ở appsettings
    public async Task<Result<AuthResponse>> GoogleLoginAsync(string idToken)
    {
        // 1. Xác minh ID token với Google (kiểm chữ ký + audience = ClientId của mình)
        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _googleSettings.ClientId }
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        }
        catch
        {
            return Result<AuthResponse>.Failure("Token Google không hợp lệ");
        }
        // 2. Tìm user theo email; chưa có thì tạo mới (không mật khẩu — đăng nhập qua Google)
        var user = await _userManager.FindByEmailAsync(payload.Email);
        if (user is null)
        {
            user = new ApplicationUser
            {
                Email = payload.Email,
                UserName = payload.Email,
                FullName = payload.Name ?? payload.Email,
                AvatarUrl = payload.Picture,
                EmailConfirmed = true// Google đã xác thực email rồi
            };
            var createResult = await _userManager.CreateAsync(user);
            if (!createResult.Succeeded)
                return Result<AuthResponse>.Failure(string.Join("; ", createResult.Errors.Select(e => e.Description)));
            //Mặc định gán user=google
            await _userManager.AddToRoleAsync(user, "User");
        }

        //3. cấp jwt hệ thống (cho cả user cũ lẫn user mới tạo)
        var response = await BuildAuthResponseAsync(user);
        return Result<AuthResponse>.Success(response);
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