using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
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
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly GoogleAuthSettings _googleSettings;
    private readonly ILogger<AuthService> _logger;
    private readonly IEmailSender _emailSender;
    private readonly IConfiguration _config;

    public AuthService(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ApplicationDbContext context,
        ITokenService tokenService,
        IOptions<GoogleAuthSettings> googleSettings,
        ILogger<AuthService> logger,
        IEmailSender emailSender,
        IConfiguration config)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _context = context;
        _tokenService = tokenService;
        _googleSettings = googleSettings.Value;
        _logger = logger;
        _emailSender = emailSender;
        _config = config;
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

        // Token Identity chứa +, /, = (base64) — PHẢI url-encode, không thì link vỡ
        // (browser/query-string hiểu sai các ký tự đó).
        var confirmLink = $"{_config["Frontend:BaseUrl"]}/confirm-email" +
            $"?userId={user.Id}&token={Uri.EscapeDataString(emailToken)}";

        await _emailSender.SendAsync(
            user.Email!,
            "Xác nhận tài khoản TOEIC Master Pro",
            $"Bấm vào link sau để xác nhận tài khoản:\n{confirmLink}");

        return Result.Success();
    }

    public async Task<Result<AuthResponse>> LoginAsync(LoginRequest req)
    {
        var user = await _userManager.FindByEmailAsync(req.Email);
        if (user is null)
            return Result<AuthResponse>.Failure("Email hoặc mật khẩu không đúng.");

        // CheckPasswordSignInAsync (KHÔNG phải PasswordSignInAsync — hàm đó issue thêm
        // cookie đăng nhập của Identity, app này chỉ dùng JWT tự cấp) — lockoutOnFailure:
        // true để SignInManager tự đếm AccessFailedCount / tự khóa khi chạm ngưỡng,
        // đúng cấu hình Lockout đã thêm ở Program.cs.
        var signInResult = await _signInManager.CheckPasswordSignInAsync(
            user, req.Password, lockoutOnFailure: true);

        if (signInResult.IsLockedOut)
            return Result<AuthResponse>.Failure(
                "Tài khoản tạm khóa do sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.");

        // IsNotAllowed = mật khẩu ĐÚNG nhưng RequireConfirmedEmail chặn vì
        // EmailConfirmed == false. Phải kiểm TRƯỚC signInResult.Succeeded — request
        // này chưa từng Succeeded, nhưng cũng không phải "sai mật khẩu".
        if (signInResult.IsNotAllowed)
            return Result<AuthResponse>.Failure(
                "Email chưa được xác thực. Vui lòng kiểm tra email để xác nhận tài khoản.");

        if (!signInResult.Succeeded)
            return Result<AuthResponse>.Failure("Email hoặc mật khẩu không đúng.");

        var response = await BuildAuthResponseAsync(user);
        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken)
    {
        // Hash giá trị thô client gửi lên rồi mới so với DB — DB chỉ lưu hash,
        // không bao giờ so trực tiếp refreshToken thô với cột Token.
        var hashed = _tokenService.HashRefreshToken(refreshToken);
        var stored = await _context.RefreshTokens
        .Include(rt => rt.User)
        .FirstOrDefaultAsync(rt => rt.Token == hashed);

        if (stored is null)
            return Result<AuthResponse>.Failure("Refresh token không hợp lệ hoặc đã hết hạn.");

        // REUSE DETECTION: token này ĐÃ bị revoke từ trước (khác với hết hạn tự nhiên)
        // mà vẫn bị mang ra dùng lại — bản hợp lệ đã rotate sang token MỚI rồi, nên
        // đây chỉ có thể là ai đó cầm 1 bản copy của token cũ (dấu hiệu bị đánh cắp).
        // Phản ứng: thu hồi TOÀN BỘ token đang hoạt động của user này (không chỉ token
        // vừa dùng lại) — chặn đứng kẻ cầm token cũ dù có phải đăng xuất oan chủ tài khoản.
        if (stored.RevokedAt is not null)
        {
            var activeTokens = await _context.RefreshTokens
                .Where(rt => rt.UserId == stored.UserId && rt.RevokedAt == null)
                .ToListAsync();
            foreach (var t in activeTokens) t.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogWarning(
                "Phát hiện refresh token đã revoke bị dùng lại (nghi bị đánh cắp) — " +
                "UserId={UserId}, đã thu hồi {Count} token đang hoạt động",
                stored.UserId, activeTokens.Count);

            return Result<AuthResponse>.Failure("Refresh token không hợp lệ hoặc đã hết hạn.");
        }

        if (stored.IsExpired)
            return Result<AuthResponse>.Failure("Refresh token không hợp lệ hoặc đã hết hạn.");

        //Thu hoi token cu
        stored.RevokedAt = DateTime.UtcNow;
        var response = await BuildAuthResponseAsync(stored.User);
        return Result<AuthResponse>.Success(response);
    }

    public async Task<Result> LogoutAsync(Guid userId, string refreshToken)
    {
        var hashed = _tokenService.HashRefreshToken(refreshToken);
        var stored = await _context.RefreshTokens
            .FirstOrDefaultAsync(rt => rt.Token == hashed);

        // Kiểm quyền sở hữu: cookie refreshToken phải thuộc ĐÚNG user đang gọi (theo
        // Bearer JWT, [Authorize] ở controller đã xác thực). Không khớp thì coi như
        // "không có gì để revoke" — không báo lỗi khác biệt để không tạo oracle
        // (kẻ tấn công dò được token của ai đó có tồn tại hay không qua response khác nhau).
        if (stored is not null && stored.UserId == userId && stored.IsActive)
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
                Audience = new[] { _googleSettings.ClientId },
                // Cho phép lệch giờ tối đa 5 phút → tránh "JWT is not yet valid" khi đồng hồ máy lệch
                IssuedAtClockTolerance = TimeSpan.FromMinutes(5),
                ExpirationTimeClockTolerance = TimeSpan.FromMinutes(5)
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(idToken, settings);
        }
        catch (Exception ex)
        {
            // Tạm lộ lý do thật để debug "lúc được lúc không"
            return Result<AuthResponse>.Failure($"Token Google không hợp lệ: {ex.Message}");
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
        var (refreshEntity, rawRefreshToken) = _tokenService.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshEntity);
        await _context.SaveChangesAsync();   // lưu refresh token mới (và revoke cũ nếu có)

        // Trả rawRefreshToken (giá trị thô) cho client — DB chỉ giữ refreshEntity.Token
        // là bản HASH, không bao giờ trả bản hash ra ngoài.
        return new AuthResponse(accessToken, rawRefreshToken, refreshEntity.ExpiresAt);
    }

}