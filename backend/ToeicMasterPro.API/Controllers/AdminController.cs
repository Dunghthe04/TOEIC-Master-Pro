using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Domain.Enums;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Tổng quan hệ thống cho Admin — "sếp xem báo cáo", không CRUD nội dung.
///
/// CHỈ ĐỌC số liệu: /overview cho các card, /stats cho biểu đồ.
/// Quản lý tài khoản (tạo, đổi vai, khoá/mở, gửi mail đặt lại mật khẩu) nằm ở
/// AdminUsersController — tách riêng vì đó là thao tác GHI lên tài khoản người khác,
/// cần UserManager + kiểm tự-hại + log, khác hẳn nhóm quan tâm của file này.
///
/// ⚠️ Toàn bộ query dùng CountAsync/GroupBy DƯỚI SQL — không nạp cả bảng vào RAM
/// rồi đếm bằng C#. Đây đúng là lỗi Repository materialize-everything mà audit
/// đã ghi (mục 3.1), tránh lặp lại nó ở endpoint mới viết.
/// </summary>
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AdminController(ApplicationDbContext db) => _db = db;

    [HttpGet("overview")]
    public async Task<IActionResult> GetOverview(CancellationToken ct)
    {
        var sevenDaysAgo = DateTime.UtcNow.AddDays(-7);

        var totalUsers = await _db.Users.CountAsync(ct);
        var newUsers7d = await _db.Users.CountAsync(u => u.CreatedAt >= sevenDaysAgo, ct);

        var totalTests = await _db.Tests.CountAsync(ct);
        var publishedTests = await _db.Tests.CountAsync(t => t.IsPublished, ct);
        var totalQuestions = await _db.Questions.CountAsync(ct);
        var totalVocabularies = await _db.Vocabularies.CountAsync(ct);

        // Lịch thi: tổng và số kỳ SẮP TỚI. Chỉ "tổng" thì vô nghĩa với Admin — bảng
        // chứa cả kỳ thi đã qua (sync từ IIG), cái đáng quan tâm là còn kỳ nào phía trước.
        var todayUtc = DateTime.UtcNow.AddHours(7).Date.AddHours(-7);
        var totalSchedules = await _db.ExamSchedules.CountAsync(ct);
        var upcomingSchedules = await _db.ExamSchedules
            .CountAsync(e => e.IsActive && e.ExamDate >= todayUtc, ct);

        var totalSessions = await _db.TestSessions.CountAsync(
            s => s.Status == TestSessionStatus.Completed, ct);
        var sessions7d = await _db.TestSessions.CountAsync(
            s => s.Status == TestSessionStatus.Completed && s.CompletedAt >= sevenDaysAgo, ct);

        // Điểm TB toàn hệ thống — chỉ tính phiên đã có TotalScore (bỏ qua null)
        var avgScore = await _db.TestSessions
            .Where(s => s.Status == TestSessionStatus.Completed && s.TotalScore != null)
            .Select(s => (double?)s.TotalScore!.Value)
            .AverageAsync(ct) ?? 0;

        // Top 5 đề được làm nhiều nhất — join + GroupBy dưới SQL, không lặp trong C#
        var topTests = await _db.TestSessions
            .Where(s => s.Status == TestSessionStatus.Completed)
            .GroupBy(s => new { s.TestId, s.Test.Title })
            .OrderByDescending(g => g.Count())
            .Take(5)
            .Select(g => new { testId = g.Key.TestId, title = g.Key.Title, attempts = g.Count() })
            .ToListAsync(ct);

        return Ok(new
        {
            users = new { total = totalUsers, new7Days = newUsers7d },
            content = new
            {
                totalTests,
                publishedTests,
                draftTests = totalTests - publishedTests,
                totalQuestions,
                totalVocabularies,
                totalSchedules,
                upcomingSchedules,
            },
            exams = new
            {
                totalSessions,
                sessions7Days = sessions7d,
                averageScore = Math.Round(avgScore, 1),
            },
            topTests,
        });
    }

    /// <summary>
    /// Số liệu cho BIỂU ĐỒ trang tổng quan — tách khỏi /overview vì đây là dữ liệu
    /// theo chuỗi (nhiều dòng), nặng hơn, và trang có thể tải sau khi các card đã hiện.
    ///
    /// Trả 3 chuỗi:
    ///   · daily      — user mới + lượt thi mỗi ngày trong N ngày gần nhất
    ///   · scoreBands — phân bố điểm theo dải 100 (xem hệ thống đang ở mức nào)
    ///   · roles      — số tài khoản theo vai
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] int days = 30, CancellationToken ct = default)
    {
        // Chặn ?days=100000: mỗi ngày là một dòng trả về, để tự do là cho phép dựng
        // response khổng lồ bằng một request rẻ tiền.
        days = Math.Clamp(days, 7, 180);

        // Mốc theo NGÀY giờ VN (UTC+7), cùng quy ước với ExamReminderService — không thì
        // biểu đồ lệch một ngày so với những gì người dùng nhìn thấy trên lịch.
        var todayVn = DateTime.UtcNow.AddHours(7).Date;
        var fromVn = todayVn.AddDays(-(days - 1));
        // Cột CreatedAt/CompletedAt lưu UTC → đổi mốc VN về UTC trước khi so trong SQL.
        var fromUtc = fromVn.AddHours(-7);

        // GroupBy theo ngày DƯỚI SQL, gom theo NGÀY GIỜ VN.
        //
        // Vì sao dùng EF.Functions.DateDiffDay thay vì `u.CreatedAt.AddHours(7).Date`:
        // chuỗi AddHours().Date lồng nhau nằm trong GroupBy là chỗ EF hay không dịch nổi
        // và lặng lẽ đánh giá phía client — với bảng users lớn thì đó là kéo cả bảng về
        // RAM. DateDiffDay dịch thẳng thành DATEDIFF(day, …) của SQL Server, luôn chạy
        // dưới DB. Nó trả về SỐ NGÀY lệch so với mốc, nên gom xong chỉ cần cộng lại
        // fromVn để biết là ngày nào.
        var usersByOffset = await _db.Users
            .Where(u => u.CreatedAt >= fromUtc)
            .GroupBy(u => EF.Functions.DateDiffDay(fromUtc, u.CreatedAt))
            .Select(g => new { Offset = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var sessionsByOffset = await _db.TestSessions
            .Where(s => s.Status == TestSessionStatus.Completed
                        && s.CompletedAt != null && s.CompletedAt >= fromUtc)
            .GroupBy(s => EF.Functions.DateDiffDay(fromUtc, s.CompletedAt!.Value))
            .Select(g => new { Offset = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var newUsersMap = usersByOffset.ToDictionary(x => x.Offset, x => x.Count);
        var sessionsMap = sessionsByOffset.ToDictionary(x => x.Offset, x => x.Count);

        // Điền đủ MỌI ngày, kể cả ngày không có dữ liệu. Thiếu ngày thì biểu đồ đường
        // nối thẳng qua khoảng trống và trông như hoạt động liên tục — sai sự thật.
        var daily = Enumerable.Range(0, days)
            .Select(i => new
            {
                date = fromVn.AddDays(i).ToString("yyyy-MM-dd"),
                newUsers = newUsersMap.GetValueOrDefault(i, 0),
                sessions = sessionsMap.GetValueOrDefault(i, 0),
            })
            .ToList();

        // Phân bố điểm theo dải 100 (0–99, 100–199, …, 900–990).
        // Tính band dưới SQL bằng phép chia nguyên, không nạp hết điểm về C#.
        var bandRows = await _db.TestSessions
            .Where(s => s.Status == TestSessionStatus.Completed && s.TotalScore != null)
            .GroupBy(s => s.TotalScore!.Value / 100)
            .Select(g => new { Band = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var bandMap = bandRows.ToDictionary(x => x.Band, x => x.Count);
        var scoreBands = Enumerable.Range(0, 10)
            .Select(b => new
            {
                // Dải cuối là 900–990 (thang TOEIC tối đa 990, không có 999).
                label = b == 9 ? "900-990" : $"{b * 100}-{b * 100 + 99}",
                count = bandMap.GetValueOrDefault(b, 0),
            })
            .ToList();

        // Số tài khoản theo vai — join UserRoles × Roles, GroupBy dưới SQL.
        var roles = await _db.UserRoles
            .Join(_db.Roles, ur => ur.RoleId, r => r.Id, (ur, r) => r.Name)
            .GroupBy(name => name)
            .Select(g => new { role = g.Key!, count = g.Count() })
            .ToListAsync(ct);

        return Ok(new { days, daily, scoreBands, roles });
    }
}
