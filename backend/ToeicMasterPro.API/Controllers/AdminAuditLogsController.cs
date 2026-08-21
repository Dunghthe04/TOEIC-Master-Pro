using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.DTOs.Admin;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.API.Controllers;

/// <summary>
/// Đọc nhật ký hành động (HM-4). Tách khỏi AdminController vì đó là nơi tổng hợp SỐ LIỆU
/// cho card/biểu đồ, còn đây là truy vấn BẢN GHI có lọc + phân trang — khác hẳn nhóm
/// quan tâm, và sẽ còn thêm bộ lọc.
///
/// CHỈ ĐỌC, và cố ý không có endpoint sửa/xoá: audit log phải append-only. Sửa được thì
/// nó không còn là bằng chứng cho câu "ai đã khoá tài khoản này". Việc dọn log cũ do
/// AuditLogCleanupJob làm theo lịch, không qua HTTP.
/// </summary>
[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "Admin")]
public class AdminAuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AdminAuditLogsController(ApplicationDbContext db) => _db = db;

    /// <summary>
    /// Danh sách nhật ký — lọc theo nhóm (2 tab), loại hành động, người thực hiện và
    /// khoảng thời gian.
    ///
    /// ⚠️ from/to là MỐC THỜI GIAN UTC, không phải ngày. AuditLog.CreatedAt lưu UtcNow,
    /// còn admin nghĩ theo ngày giờ VN — "ngày 21/08" của họ là 20/08 17:00 → 21/08 17:00
    /// UTC. Việc quy đổi để FE làm vì chỉ trình duyệt biết múi giờ của người đang xem;
    /// server chỉ so sánh trên trục UTC. Nếu server tự đoán múi giờ thì admin ở múi khác
    /// sẽ thấy log lệch một ngày mà không hiểu vì sao.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetLogs(
        [FromQuery] AuditCategory? category,
        [FromQuery] string? action,
        [FromQuery] string? actorEmail,
        [FromQuery] Guid? targetId,
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        // Chặn pageSize khổng lồ: ?pageSize=1000000 là request rẻ đổi lấy việc server dựng
        // cả bảng log trong RAM — mà đây đúng là bảng to nhất hệ thống (mỗi lần login một
        // dòng). Cùng lý do như AdminUsersController.
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.AuditLogs.AsNoTracking();

        if (category is not null)
            query = query.Where(l => l.Category == category);

        // So sánh CHÍNH XÁC, không LIKE: Action là giá trị trong AuditActions, FE chọn từ
        // dropdown chứ không gõ tay. Dùng index IX_AuditLogs_Action.
        if (!string.IsNullOrWhiteSpace(action))
        {
            var a = action.Trim();
            query = query.Where(l => l.Action == a);
        }

        if (!string.IsNullOrWhiteSpace(actorEmail))
        {
            var s = actorEmail.Trim();
            // Escape %, _, [ — không escape thì tìm "a_b" biến _ thành wildcard khớp mọi
            // ký tự. Cùng cách xử lý như AdminUsersController.
            var pattern = $"%{s.Replace("[", "[[]").Replace("%", "[%]").Replace("_", "[_]")}%";
            query = query.Where(l => EF.Functions.Like(l.ActorEmail, pattern));
        }

        // "Tài khoản này đã bị làm những gì" — lối vào từ trang chi tiết học viên.
        if (targetId is not null)
            query = query.Where(l => l.TargetId == targetId);

        if (from is not null)
            query = query.Where(l => l.CreatedAt >= from);

        if (to is not null)
            query = query.Where(l => l.CreatedAt <= to);

        var total = await query.CountAsync(ct);

        // Sắp giảm dần theo CreatedAt để khớp index IX_AuditLogs_CreatedAt (IsDescending)
        // → không phải sort lại. Skip/Take chạy DƯỚI SQL.
        var items = await query
            .OrderByDescending(l => l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new AuditLogListItem(
                l.Id,
                l.CreatedAt,
                l.Category.ToString(),
                l.Action,
                l.ActorId,
                l.ActorEmail,
                l.TargetType,
                l.TargetId,
                l.TargetLabel,
                l.Detail,
                l.IpAddress))
            .ToListAsync(ct);

        return Ok(new PagedResult<AuditLogListItem>(items, total, page, pageSize));
    }

    /// <summary>
    /// Các loại hành động ĐANG CÓ trong log, để dựng dropdown lọc.
    ///
    /// Lấy DISTINCT từ DB thay vì trả danh sách hằng số trong AuditActions: dropdown chỉ
    /// nên hiện thứ thật sự lọc ra được cái gì. Liệt kê cả hằng số thì admin chọn một loại
    /// chưa từng xảy ra rồi thấy bảng rỗng và tưởng bộ lọc hỏng.
    ///
    /// Rẻ: cardinality ~17 giá trị và có index IX_AuditLogs_Action.
    /// </summary>
    [HttpGet("actions")]
    public async Task<IActionResult> GetActions(
        [FromQuery] AuditCategory? category,
        CancellationToken ct = default)
    {
        var query = _db.AuditLogs.AsNoTracking();

        if (category is not null)
            query = query.Where(l => l.Category == category);

        var actions = await query
            .Select(l => l.Action)
            .Distinct()
            .OrderBy(a => a)
            .ToListAsync(ct);

        return Ok(actions);
    }
}
