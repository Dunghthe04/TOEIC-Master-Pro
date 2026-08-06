using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Domain.Enums;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Tổng quan hệ thống cho Admin — "sếp xem báo cáo", không CRUD nội dung.
///
/// Đây là bản TỐI THIỂU cho trang chủ /admin (chỉ 1 endpoint đọc số liệu). Quản lý
/// tài khoản đầy đủ (gán/thu role, khóa/mở) là việc Day 37 — chưa làm ở đây, vì
/// UserManager/RoleManager cần thêm DTO + validate riêng, không nhét vội vào đây.
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
            content = new { totalTests, publishedTests, draftTests = totalTests - publishedTests, totalQuestions },
            exams = new
            {
                totalSessions,
                sessions7Days = sessions7d,
                averageScore = Math.Round(avgScore, 1),
            },
            topTests,
        });
    }
}
