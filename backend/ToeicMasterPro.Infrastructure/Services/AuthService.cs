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

        // SMTP lỗi ở đây là trạng thái TẮC HOÀN TOÀN nếu bỏ qua: user đã nằm trong DB
        // với EmailConfirmed=false → RequireConfirmedEmail chặn đăng nhập, mà mail xác
        // nhận thì không bao giờ tới, và đăng ký lại thì vướng chính tài khoản vừa tạo.
        // Trước đây không bọc try/catch nên exception bay ra thành 500 SAU KHI user đã
        // được tạo — đúng cái trạng thái tắc đó, chỉ khác là user không biết vì sao.
        // → Xoá user vừa tạo, trả DB về trạng thái sạch để họ đăng ký lại được ngay.
        //   (Cách đúng về lâu dài là endpoint "gửi lại mail xác nhận"; khi có nó thì
        //    đổi sang giữ user và để họ tự yêu cầu gửi lại.)
        try
        {
            await _emailSender.SendAsync(
                user.Email,
                "Xác nhận tài khoản TOEIC Master Pro",
                $"Bấm vào link sau để xác nhận tài khoản:\n{confirmLink}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Gửi mail xác nhận thất bại — đã rollback user vừa tạo. Email={Email}", user.Email);
            await _userManager.DeleteAsync(user);
            return Result.Failure("Không gửi được email xác nhận. Vui lòng thử lại sau.");
        }

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

        // Thông báo này CÓ rò rỉ "email này tồn tại" — chấp nhận CÓ CHỦ Ý: muốn khóa
        // được một tài khoản thì phải sai mật khẩu 5 lần, mà email không tồn tại đã bị
        // chặn ở trên (user is null) nên không bao giờ vào được trạng thái khóa. Che nó
        // đi thì user thật bị khóa 15 phút mà không hiểu vì sao → đánh đổi ngược, mất
        // nhiều hơn được.
        if (signInResult.IsLockedOut)
            return Result<AuthResponse>.Failure(
                "Tài khoản tạm khóa do sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.");

        // IsNotAllowed = RequireConfirmedEmail chặn vì EmailConfirmed == false. Phải
        // kiểm TRƯỚC signInResult.Succeeded — request này chưa từng Succeeded, nhưng
        // cũng không phải "sai mật khẩu".
        //
        // ⚠️ SignInManager chạy PreSignInCheck(user) TRƯỚC khi kiểm mật khẩu, và
        // IsNotAllowed sinh ra từ chính PreSignInCheck đó → nó trả về BẤT KỂ mật khẩu
        // đúng hay sai. Trả thẳng thông báo ra là cho phép bất kỳ ai gõ email nạn nhân
        // kèm mật khẩu rác để dò xem email nào có tài khoản (user enumeration) — cùng
        // họ vấn đề với "Email đã được sử dụng" ở RegisterAsync.
        // → Chỉ nói thật với người CHỨNG MINH được là họ biết mật khẩu.
        //
        // CheckPasswordAsync chỉ so hash, KHÔNG đi qua PreSignInCheck nên không bị
        // NotAllowed chặn lần nữa; nó cũng không đếm AccessFailedCount, mà cũng không
        // cần: PreSignInCheck đã chặn từ đầu nên lockout vốn đã không đếm cho tài khoản
        // chưa xác thực email.
        if (signInResult.IsNotAllowed)
        {
            if (await _userManager.CheckPasswordAsync(user, req.Password))
                return Result<AuthResponse>.Failure(
                    "Email chưa được xác thực. Vui lòng kiểm tra email để xác nhận tài khoản.");

            return Result<AuthResponse>.Failure("Email hoặc mật khẩu không đúng.");
        }

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
    //idToken (JWT) = {email: "...", name: "...", sub: "1078...", aud: "164202546206-...apps.googleusercontent.com", signature: "..."}
    //aud chính là id cho project -> so sánh aud với mã set ở appsettings
    //sub là ĐỊNH DANH THẬT của tài khoản Google: bất biến, không ai khai khống được.
    //Email chỉ là THUỘC TÍNH (đổi được, ai cũng gõ được vào form đăng ký) nên không
    //bao giờ được dùng làm khoá định danh -> xem phân tích 3 nhánh ở bước 3 bên dưới.
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
            // Chi tiết lỗi CHỈ vào log (mình đọc được), client nhận thông báo chung.
            // ex.Message của Google chứa audience/issuer/thời điểm hết hạn — trả ra ngoài
            // là chỉ cho kẻ tấn công token của họ sai ở ĐÂU để sửa cho đúng.
            _logger.LogWarning(ex, "Xác minh Google ID token thất bại");
            return Result<AuthResponse>.Failure("Token Google không hợp lệ.");
        }

        // 1b. Google đã ký, nhưng ký KHÔNG có nghĩa là email đã được xác minh.
        //     EmailVerified == false → email chỉ là chữ user tự khai, không chứng minh
        //     quyền sở hữu. Mọi logic bên dưới dựa vào "Google bảo đảm người này sở hữu
        //     email này", nên cờ này sai là toàn bộ bên dưới sụp.
        if (!payload.EmailVerified || string.IsNullOrEmpty(payload.Email))
            return Result<AuthResponse>.Failure("Tài khoản Google chưa xác thực email.");

        // Token không có `sub` là token dị dạng — mà `sub` chính là khoá liên kết ở bước 2,
        // để null lọt xuống sẽ ghi ProviderKey = null và nổ ở tầng DB.
        if (string.IsNullOrEmpty(payload.Subject))
            return Result<AuthResponse>.Failure("Token Google không hợp lệ.");

        // 2. ĐƯỜNG TÌM CHÍNH: theo `sub`, KHÔNG theo email.
        //    Email đổi được (Workspace đổi địa chỉ chính, hoặc admin cấp lại địa chỉ của
        //    nhân viên cũ cho nhân viên mới) → tìm theo email thì user đổi mail sẽ bị tạo
        //    tài khoản thứ hai và mất sạch lịch sử thi. `sub` bất biến nên không có chuyện đó.
        const string googleProvider = "Google";
        var user = await _userManager.FindByLoginAsync(googleProvider, payload.Subject);

        if (user is null)
        {
            // 3. `sub` này chưa liên kết với tài khoản nào. Xem email có đang bị giữ không —
            //    ĐÂY CHÍNH LÀ CHỖ LỖ HỔNG pre-hijack nằm ở code cũ: code cũ tìm thấy là
            //    login thẳng, không hỏi tài khoản đó của ai.
            user = await _userManager.FindByEmailAsync(payload.Email);

            if (user is null)
            {
                // 3a. Hoàn toàn mới → tạo tài khoản, KHÔNG mật khẩu.
                user = new ApplicationUser
                {
                    Email = payload.Email,
                    UserName = payload.Email,
                    FullName = payload.Name ?? payload.Email,
                    AvatarUrl = payload.Picture,
                    EmailConfirmed = true   // đã kiểm EmailVerified ở bước 1b
                };
                var createResult = await _userManager.CreateAsync(user);
                if (!createResult.Succeeded)
                    return Result<AuthResponse>.Failure(
                        string.Join("; ", createResult.Errors.Select(e => e.Description)));

                //Mặc định gán user=google
                await _userManager.AddToRoleAsync(user, "User");
            }
            else
            {
                var hasPassword = await _userManager.HasPasswordAsync(user);

                // 3b. Tài khoản mật khẩu THẬT, đã xác thực email → chủ nó đã chứng minh
                //     sở hữu email bằng cách bấm link trong hộp thư. Tự gộp vào đây chính
                //     là lỗ hổng cũ → TỪ CHỐI. (Muốn dùng Google thì đăng nhập bằng mật
                //     khẩu rồi liên kết trong phần cài đặt — luồng đó để sau.)
                if (hasPassword && user.EmailConfirmed)
                    return Result<AuthResponse>.Failure(
                        "Email này đã có tài khoản đăng nhập bằng mật khẩu. Vui lòng đăng nhập bằng mật khẩu.");

                // 3c. TÀI KHOẢN SQUAT (pre-hijack): có mật khẩu nhưng CHƯA TỪNG xác thực
                //     email. Google vừa chứng minh người đang gọi SỞ HỮU email này, còn
                //     người đặt mật khẩu kia chưa chứng minh được gì → bên chứng minh
                //     được thắng. Xoá mật khẩu chưa xác thực đó đi, nếu không nó là bom
                //     hẹn giờ: hôm nào EmailConfirmed bật lên là mật khẩu đó sống lại.
                if (hasPassword && !user.EmailConfirmed)
                {
                    var removePwd = await _userManager.RemovePasswordAsync(user);
                    if (!removePwd.Succeeded)
                        return Result<AuthResponse>.Failure(
                            "Không xử lý được tài khoản này. Vui lòng liên hệ hỗ trợ.");

                    user.EmailConfirmed = true;
                    await _userManager.UpdateAsync(user);

                    // Tài khoản squat có thể đã kịp lấy refresh token TRƯỚC khi
                    // RequireConfirmedEmail được bật → refresh token sống 30 ngày, xoá
                    // mật khẩu mà không thu hồi token là vá nửa vời.
                    var squatTokens = await _context.RefreshTokens
                        .Where(rt => rt.UserId == user.Id && rt.RevokedAt == null)
                        .ToListAsync();
                    foreach (var t in squatTokens) t.RevokedAt = DateTime.UtcNow;
                    if (squatTokens.Count > 0) await _context.SaveChangesAsync();

                    _logger.LogWarning(
                        "Google login thu hồi mật khẩu của tài khoản chưa xác thực email " +
                        "(nghi pre-hijack) — UserId={UserId}, revoke {Count} refresh token",
                        user.Id, squatTokens.Count);
                }

                // 3d. hasPassword == false → user Google CŨ (code trước khi vá tạo tài
                //     khoản không mật khẩu và không ghi AspNetUserLogins). Chỉ luồng Google
                //     tạo được tài khoản không mật khẩu nên đây chắc chắn chính chủ →
                //     không làm gì, đi tiếp xuống bước 4 để gắn `sub`.
            }

            // 4. Gắn `sub` vào AspNetUserLogins — từ lần sau FindByLoginAsync tìm thấy ngay,
            //    không bao giờ phải dựa vào email nữa. Bảng này đã có từ InitialCreate nên
            //    KHÔNG cần migration.
            var addLogin = await _userManager.AddLoginAsync(
                user, new UserLoginInfo(googleProvider, payload.Subject, googleProvider));
            if (!addLogin.Succeeded)
                return Result<AuthResponse>.Failure(
                    string.Join("; ", addLogin.Errors.Select(e => e.Description)));
        }

        //5. cấp jwt hệ thống (cho cả user cũ lẫn user mới tạo/mới liên kết)
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