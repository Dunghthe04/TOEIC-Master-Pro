using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Admin;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Quản lý tài khoản — việc riêng của Admin ("sếp quản người").
///
/// VÌ SAO TÁCH KHỎI AdminController: file kia chỉ đọc số liệu tổng quan (một endpoint,
/// không state). Ở đây là thao tác GHI lên tài khoản người khác — cần UserManager,
/// RoleManager, kiểm tự-hại, và log. Gộp chung thành một file 400 dòng làm hai nhóm
/// quan tâm khác nhau dính vào nhau.
///
/// NGUYÊN TẮC ĐÃ CHỐT:
///   · Admin KHÔNG BAO GIỜ biết mật khẩu của ai — chỉ gửi được mail đặt lại. Biết mật
///     khẩu là mạo danh được, và không còn cách nào chứng minh hành động là của user.
///   · KHÔNG xoá tài khoản, chỉ khoá/mở. Xoá user đã thi thì vướng FK TestSessions,
///     hoặc mất sạch lịch sử thi → méo thống kê toàn hệ thống. Khoá đủ để chặn truy cập.
///   · Admin không tự hạ vai / tự khoá mình — xem CheckNotSelf.
/// </summary>
[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin")]
public class AdminUsersController : ControllerBase
{
    /// <summary>Vai hợp lệ — chặn Admin gán một chuỗi bất kỳ thành role rác trong DB.</summary>
    private static readonly string[] AllowedRoles = ["User", "ContentManager", "Admin"];

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly IEmailSender _email;
    private readonly IConfiguration _config;
    private readonly ICurrentUserService _currentUser;
    private readonly ILogger<AdminUsersController> _logger;

    public AdminUsersController(
        UserManager<ApplicationUser> userManager,
        ApplicationDbContext db,
        IEmailSender email,
        IConfiguration config,
        ICurrentUserService currentUser,
        ILogger<AdminUsersController> logger)
    {
        _userManager = userManager;
        _db = db;
        _email = email;
        _config = config;
        _currentUser = currentUser;
        _logger = logger;
    }

    /// <summary>
    /// Danh sách tài khoản — phân trang, tìm theo email/tên, lọc theo vai và trạng thái.
    ///
    /// ⚠️ Phân trang DƯỚI SQL (Skip/Take), và số lượt thi lấy bằng MỘT query GroupBy cho
    /// cả trang — không phải N+1 (mỗi user một query). Với 6 user thì không thấy khác
    /// biệt, với 5000 thì là chênh lệch giữa 2 query và 5001 query.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? lockedOnly,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        // Chặn pageSize khổng lồ: ?pageSize=1000000 là một request rẻ đổi lấy việc server
        // dựng cả bảng users trong RAM (DoS rẻ tiền).
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _db.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            // EF.Functions.Like để so sánh chạy dưới SQL. Escape %, _, [ — không escape
            // thì search "100%" biến thành wildcard khớp mọi thứ.
            var pattern = $"%{s.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]")}%";
            query = query.Where(u =>
                EF.Functions.Like(u.Email!, pattern) || EF.Functions.Like(u.FullName, pattern));
        }

        if (!string.IsNullOrWhiteSpace(role) && AllowedRoles.Contains(role))
        {
            // Join qua bảng Identity thay vì GetUsersInRoleAsync: hàm đó nạp TOÀN BỘ user
            // của vai đó vào RAM rồi mới lọc/phân trang trong C#.
            var roleId = await _db.Roles
                .Where(r => r.Name == role)
                .Select(r => r.Id)
                .FirstOrDefaultAsync(ct);

            query = query.Where(u => _db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == roleId));
        }

        if (lockedOnly == true)
        {
            var now = DateTimeOffset.UtcNow;
            query = query.Where(u => u.LockoutEnd != null && u.LockoutEnd > now);
        }

        var total = await query.CountAsync(ct);

        var pageUsers = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id, u.Email, u.FullName, u.AvatarUrl, u.EmailConfirmed,
                u.LockoutEnd, u.AccessFailedCount, u.Plan, u.TargetScore,
                u.XpPoints, u.StreakDays, u.CreatedAt,
            })
            .ToListAsync(ct);

        var ids = pageUsers.Select(u => u.Id).ToList();

        // Roles của CẢ TRANG trong một query — thay cho GetRolesAsync() gọi trong vòng lặp.
        var rolesByUser = await _db.UserRoles
            .Where(ur => ids.Contains(ur.UserId))
            .Join(_db.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => new { ur.UserId, r.Name })
            .GroupBy(x => x.UserId)
            .Select(g => new { UserId = g.Key, Names = g.Select(x => x.Name!).ToList() })
            .ToDictionaryAsync(x => x.UserId, x => x.Names, ct);

        // Số lượt thi + điểm cao nhất của cả trang, cũng một query.
        var statsByUser = await _db.TestSessions
            .Where(s => ids.Contains(s.UserId) && s.Status == TestSessionStatus.Completed)
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                Count = g.Count(),
                Best = g.Max(s => s.TotalScore),
            })
            .ToDictionaryAsync(x => x.UserId, x => new { x.Count, x.Best }, ct);

        var now2 = DateTimeOffset.UtcNow;
        var items = pageUsers.Select(u => new AdminUserListItem(
            u.Id,
            u.Email ?? string.Empty,
            u.FullName,
            u.AvatarUrl,
            rolesByUser.GetValueOrDefault(u.Id) ?? [],
            u.EmailConfirmed,
            u.LockoutEnd is not null && u.LockoutEnd > now2,
            u.LockoutEnd?.UtcDateTime,
            u.AccessFailedCount,
            u.Plan.ToString(),
            u.TargetScore,
            u.XpPoints,
            u.StreakDays,
            u.CreatedAt,
            statsByUser.GetValueOrDefault(u.Id)?.Count ?? 0,
            statsByUser.GetValueOrDefault(u.Id)?.Best
        )).ToList();

        return Ok(new PagedResult<AdminUserListItem>(items, total, page, pageSize));
    }

    /// <summary>
    /// Tạo tài khoản mới — chủ yếu để lập tài khoản ContentManager cho nhân sự.
    ///
    /// Tài khoản tạo ra KHÔNG có mật khẩu; hệ thống gửi mail đặt lại để chính người đó
    /// tự đặt. Admin không đặt mật khẩu hộ (xem ghi chú đầu file).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest req, CancellationToken ct)
    {
        var roles = NormalizeRoles(req.Roles, out var invalidRole);
        if (invalidRole is not null)
            return BadRequest(new { error = $"Vai không hợp lệ: {invalidRole}." });

        var email = req.Email.Trim();
        if (await _userManager.FindByEmailAsync(email) is not null)
            // 409, và ở đây tiết lộ "email đã tồn tại" là CHẤP NHẬN ĐƯỢC: người gọi đã
            // là Admin đã xác thực, không phải khách vô danh dò email (khác hẳn
            // RegisterAsync — chỗ đó phải trả lời trung tính).
            return Conflict(new { error = "Email này đã có tài khoản." });

        var user = new ApplicationUser
        {
            Email = email,
            UserName = email,
            FullName = req.FullName.Trim(),
            // Chính Admin đã xác nhận địa chỉ này của nhân sự → không bắt bấm link xác
            // thực nữa. Không đặt true thì RequireConfirmedEmail chặn đăng nhập, mà mail
            // xác thực lại không được gửi ở luồng này → tài khoản chết ngay khi tạo.
            EmailConfirmed = true,
        };

        var created = await _userManager.CreateAsync(user);   // KHÔNG truyền mật khẩu
        if (!created.Succeeded)
            return BadRequest(new { error = string.Join("; ", created.Errors.Select(e => e.Description)) });

        var roleResult = await _userManager.AddToRolesAsync(user, roles);
        if (!roleResult.Succeeded)
        {
            // Gán vai thất bại thì tài khoản vừa tạo là rác không vai — xoá đi để không
            // để lại trạng thái nửa vời (UserManager không có transaction cho hai bước này).
            await _userManager.DeleteAsync(user);
            return BadRequest(new { error = string.Join("; ", roleResult.Errors.Select(e => e.Description)) });
        }

        var mailSent = await TrySendSetPasswordMailAsync(user, isNewAccount: true);

        _logger.LogInformation(
            "Admin {AdminId} tạo tài khoản {Email} với vai {Roles}",
            _currentUser.UserId, email, string.Join(",", roles));

        return CreatedAtAction(nameof(GetUsers), new { }, new
        {
            id = user.Id,
            message = mailSent
                ? "Đã tạo tài khoản và gửi mail để người dùng tự đặt mật khẩu."
                // Nói thật khi mail lỗi: im lặng báo thành công thì Admin ngồi đợi một
                // email không bao giờ tới, còn tài khoản thì không có mật khẩu để vào.
                : "Đã tạo tài khoản, NHƯNG gửi mail đặt mật khẩu thất bại. "
                  + "Hãy bấm \"Gửi lại mail đặt mật khẩu\" ở dòng tài khoản này.",
        });
    }

    /// <summary>Đặt lại toàn bộ vai của một tài khoản.</summary>
    [HttpPut("{id:Guid}/roles")]
    public async Task<IActionResult> UpdateRoles(
        Guid id, [FromBody] UpdateUserRolesRequest req, CancellationToken ct)
    {
        var roles = NormalizeRoles(req.Roles, out var invalidRole);
        if (invalidRole is not null)
            return BadRequest(new { error = $"Vai không hợp lệ: {invalidRole}." });

        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { error = "Không tìm thấy tài khoản." });

        // Tự hạ vai mình là tự khoá cửa: Admin duy nhất bỏ vai Admin của chính mình thì
        // không còn ai vào được trang quản trị, và không có đường nào sửa ngoài SQL tay.
        if (SelfId == id && !roles.Contains("Admin"))
            return BadRequest(new { error = "Bạn không thể tự bỏ vai Admin của chính mình." });

        // Không cho hạ vai Admin CUỐI CÙNG — cùng lý do trên, chỉ khác là người bị hạ là
        // Admin khác. Đếm trước khi đổi, và chỉ đếm khi thao tác này thật sự làm mất
        // một Admin.
        if (!roles.Contains("Admin") && await _userManager.IsInRoleAsync(user, "Admin"))
        {
            var adminCount = (await _userManager.GetUsersInRoleAsync("Admin")).Count;
            if (adminCount <= 1)
                return BadRequest(new { error = "Hệ thống phải còn ít nhất một Admin." });
        }

        var current = await _userManager.GetRolesAsync(user);
        var toRemove = current.Except(roles).ToList();
        var toAdd = roles.Except(current).ToList();

        if (toRemove.Count > 0)
        {
            var removed = await _userManager.RemoveFromRolesAsync(user, toRemove);
            if (!removed.Succeeded)
                return BadRequest(new { error = string.Join("; ", removed.Errors.Select(e => e.Description)) });
        }
        if (toAdd.Count > 0)
        {
            var added = await _userManager.AddToRolesAsync(user, toAdd);
            if (!added.Succeeded)
                return BadRequest(new { error = string.Join("; ", added.Errors.Select(e => e.Description)) });
        }

        _logger.LogInformation(
            "Admin {AdminId} đổi vai của {UserId}: {Old} → {New}",
            SelfId, id, string.Join(",", current), string.Join(",", roles));

        return Ok(new { message = "Đã cập nhật vai." });
    }

    /// <summary>
    /// Khoá / mở tài khoản.
    ///
    /// Khoá = đặt LockoutEnd ở tương lai (cơ chế sẵn của Identity, cùng cái mà lockout
    /// sai-mật-khẩu-5-lần dùng) → SignInManager tự chặn đăng nhập, không phải thêm cờ mới.
    ///
    /// ⚠️ Khoá KHÔNG đá người đang đăng nhập ra ngay: access token đã cấp vẫn hợp lệ tới
    /// khi hết hạn. Nên phải thu hồi refresh token, không thì họ tiếp tục gia hạn phiên
    /// vô thời hạn dù đã bị khoá.
    /// </summary>
    [HttpPut("{id:Guid}/lock")]
    public async Task<IActionResult> SetLock(
        Guid id, [FromBody] LockUserRequest req, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { error = "Không tìm thấy tài khoản." });

        if (SelfId == id && req.Lock)
            return BadRequest(new { error = "Bạn không thể tự khoá tài khoản của mình." });

        if (req.Lock)
        {
            // Days null = khoá vô thời hạn.
            var until = req.Days is null
                ? DateTimeOffset.MaxValue
                : DateTimeOffset.UtcNow.AddDays(req.Days.Value);

            // SetLockoutEnabledAsync trước: LockoutEnd có giá trị mà LockoutEnabled=false
            // thì Identity BỎ QUA nó — khoá không có tác dụng.
            await _userManager.SetLockoutEnabledAsync(user, true);
            var res = await _userManager.SetLockoutEndDateAsync(user, until);
            if (!res.Succeeded)
                return BadRequest(new { error = string.Join("; ", res.Errors.Select(e => e.Description)) });

            var revoked = await _db.RefreshTokens
                .Where(rt => rt.UserId == id && rt.RevokedAt == null)
                .ToListAsync(ct);
            foreach (var t in revoked) t.RevokedAt = DateTime.UtcNow;
            if (revoked.Count > 0) await _db.SaveChangesAsync(ct);

            _logger.LogWarning(
                "Admin {AdminId} khoá tài khoản {UserId} đến {Until}, thu hồi {Count} refresh token",
                SelfId, id, until, revoked.Count);

            return Ok(new
            {
                message = req.Days is null
                    ? "Đã khoá tài khoản vô thời hạn."
                    : $"Đã khoá tài khoản {req.Days} ngày.",
            });
        }

        // Mở khoá: xoá LockoutEnd VÀ reset bộ đếm sai mật khẩu. Không reset thì
        // AccessFailedCount vẫn ở 4/5 và user sai một lần nữa là bị khoá lại ngay.
        var unlock = await _userManager.SetLockoutEndDateAsync(user, null);
        if (!unlock.Succeeded)
            return BadRequest(new { error = string.Join("; ", unlock.Errors.Select(e => e.Description)) });
        await _userManager.ResetAccessFailedCountAsync(user);

        _logger.LogInformation("Admin {AdminId} mở khoá tài khoản {UserId}", SelfId, id);
        return Ok(new { message = "Đã mở khoá tài khoản." });
    }

    /// <summary>
    /// Gửi mail đặt lại mật khẩu cho một tài khoản.
    ///
    /// Admin KHÔNG đặt mật khẩu trực tiếp: chỉ người sở hữu hộp thư mới đặt được mật
    /// khẩu của mình. Nhờ vậy không tồn tại tình huống "Admin biết mật khẩu của user"
    /// — tức là không mạo danh được, và mọi hành động trong hệ thống vẫn quy được về
    /// đúng chủ tài khoản.
    /// </summary>
    [HttpPost("{id:Guid}/send-password-reset")]
    public async Task<IActionResult> SendPasswordReset(Guid id, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { error = "Không tìm thấy tài khoản." });

        var sent = await TrySendSetPasswordMailAsync(user, isNewAccount: false);
        if (!sent)
            // 502: lỗi ở dịch vụ bên ngoài (SMTP), không phải request sai. Nói thật để
            // Admin biết mà thử lại, thay vì báo thành công rồi cả hai bên ngồi đợi.
            return StatusCode(StatusCodes.Status502BadGateway,
                new { error = "Không gửi được email. Kiểm tra cấu hình SMTP rồi thử lại." });

        _logger.LogInformation(
            "Admin {AdminId} gửi mail đặt lại mật khẩu cho {UserId}", SelfId, id);
        return Ok(new { message = $"Đã gửi mail đặt lại mật khẩu tới {user.Email}." });
    }

    /// <summary>
    /// Xác thực email thủ công — dùng khi user không nhận được mail xác nhận
    /// (mail vào spam, gõ sai địa chỉ rồi Admin sửa hộ...). Không có đường này thì
    /// tài khoản đó bị RequireConfirmedEmail chặn vĩnh viễn.
    /// </summary>
    [HttpPost("{id:Guid}/confirm-email")]
    public async Task<IActionResult> ConfirmEmail(Guid id, CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { error = "Không tìm thấy tài khoản." });

        if (user.EmailConfirmed)
            return Conflict(new { error = "Email này đã được xác thực." });

        user.EmailConfirmed = true;
        var res = await _userManager.UpdateAsync(user);
        if (!res.Succeeded)
            return BadRequest(new { error = string.Join("; ", res.Errors.Select(e => e.Description)) });

        _logger.LogInformation("Admin {AdminId} xác thực email thủ công cho {UserId}", SelfId, id);
        return Ok(new { message = "Đã xác thực email." });
    }

    /// <summary>
    /// Chi tiết một tài khoản — thông tin + thống kê thi + lịch sử thi.
    ///
    /// VÌ SAO CẦN: bảng danh sách chỉ cho biết "có 7 lượt thi", không xem được bên trong.
    /// Học viên báo "điểm của tôi bị sai" thì Admin không có cách nào kiểm.
    ///
    /// TÁI DÙNG ITestSessionService: các hàm thống kê đã NHẬN userId làm tham số (không
    /// đọc từ token), nên Admin truyền userId của người khác vào là dùng lại được nguyên
    /// vẹn — không phải viết lại logic tính điểm/gom Part lần thứ hai. Hai bản logic
    /// song song là chắc chắn sẽ lệch nhau, và lúc đó không biết bản nào đúng.
    /// </summary>
    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetUserDetail(
        Guid id,
        [FromServices] ITestSessionService sessions,
        CancellationToken ct)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null) return NotFound(new { error = "Không tìm thấy tài khoản." });

        var roles = await _userManager.GetRolesAsync(user);

        // fullOnly: false — Admin cần thấy TẤT CẢ, kể cả phiên thi từng phần. Học viên
        // xem dashboard của mình thì mặc định true (không so partial với thang 990),
        // nhưng ở đây đang đi kiểm tra nên che bớt dữ liệu là phản tác dụng.
        var overview = await sessions.GetStatsOverviewAsync(id, fullOnly: false);
        var parts = await sessions.GetStatsPartsAsync(id, fullOnly: false);
        var timeline = await sessions.GetStatsTimelineAsync(id, fullOnly: false);
        var history = await sessions.GetHistoryAsync(id, null, page: 1, pageSize: 50);

        return Ok(new
        {
            profile = new
            {
                id = user.Id,
                email = user.Email,
                fullName = user.FullName,
                avatarUrl = user.AvatarUrl,
                roles,
                emailConfirmed = user.EmailConfirmed,
                isLockedOut = user.LockoutEnd is not null && user.LockoutEnd > DateTimeOffset.UtcNow,
                lockoutEnd = user.LockoutEnd?.UtcDateTime,
                accessFailedCount = user.AccessFailedCount,
                plan = user.Plan.ToString(),
                targetScore = user.TargetScore,
                examDate = user.ExamDate,
                xpPoints = user.XpPoints,
                streakDays = user.StreakDays,
                lastStudyDate = user.LastStudyDate,
                createdAt = user.CreatedAt,
            },
            // Mỗi phần trả null nếu service báo lỗi (VD user chưa thi lần nào) — để FE
            // ẩn đúng khối đó, thay vì cả trang 500 vì một mảng rỗng.
            overview = overview.IsSuccess ? overview.Value : null,
            parts = parts.IsSuccess ? parts.Value : null,
            timeline = timeline.IsSuccess ? timeline.Value : null,
            history = history.IsSuccess ? history.Value : null,
        });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private Guid? SelfId => _currentUser.UserId;

    /// <summary>
    /// Chuẩn hoá + kiểm danh sách vai. Trả về danh sách đã loại trùng; `invalidRole`
    /// có giá trị nếu gặp vai lạ (whitelist, không nhận chuỗi tuỳ ý).
    /// </summary>
    private static List<string> NormalizeRoles(IReadOnlyList<string>? input, out string? invalidRole)
    {
        invalidRole = null;
        var result = new List<string>();
        foreach (var raw in input ?? [])
        {
            var r = raw?.Trim();
            if (string.IsNullOrEmpty(r)) continue;

            // So sánh không phân biệt hoa/thường rồi lấy tên CHUẨN trong whitelist —
            // gửi "admin" cũng thành "Admin", vì tên role trong DB phân biệt chữ.
            var canonical = AllowedRoles.FirstOrDefault(
                a => string.Equals(a, r, StringComparison.OrdinalIgnoreCase));
            if (canonical is null) { invalidRole = r; return result; }
            if (!result.Contains(canonical)) result.Add(canonical);
        }
        return result;
    }

    /// <summary>
    /// Sinh token đặt lại mật khẩu + gửi mail. Trả false nếu SMTP lỗi (đã ghi log).
    ///
    /// Dùng CHUNG link "/?reset=1&amp;email=…&amp;token=…" với luồng quên mật khẩu — một
    /// đích đến duy nhất, sửa UI một chỗ. Xem AuthService.ForgotPasswordAsync.
    /// </summary>
    private async Task<bool> TrySendSetPasswordMailAsync(ApplicationUser user, bool isNewAccount)
    {
        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var link = $"{_config["Frontend:BaseUrl"]}/?reset=1" +
                   $"&email={Uri.EscapeDataString(user.Email!)}" +
                   $"&token={Uri.EscapeDataString(token)}";

        var subject = isNewAccount
            ? "Tài khoản TOEIC Master Pro của bạn đã được tạo"
            : "Đặt lại mật khẩu TOEIC Master Pro";

        var body = isNewAccount
            ? $"Xin chào {user.FullName},\n\n" +
              "Quản trị viên đã tạo tài khoản TOEIC Master Pro cho bạn.\n" +
              $"Bấm vào link sau để đặt mật khẩu và bắt đầu sử dụng:\n{link}\n"
            : "Quản trị viên đã yêu cầu đặt lại mật khẩu cho tài khoản của bạn.\n" +
              $"Bấm vào link sau để đặt mật khẩu mới:\n{link}\n\n" +
              "Nếu bạn không mong đợi email này, hãy liên hệ quản trị viên.";

        try
        {
            await _email.SendAsync(user.Email!, subject, body);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Gửi mail đặt mật khẩu thất bại — UserId={UserId}, isNewAccount={IsNew}",
                user.Id, isNewAccount);
            return false;
        }
    }
}
