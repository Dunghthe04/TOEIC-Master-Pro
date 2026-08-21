using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.ExamSchedules;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// KHÔNG có [Authorize] cấp class — mọi action đã ghi rõ Roles hoặc [AllowAnonymous].
// Đặt [Authorize] trần ở đây là DƯ: nó trùng đúng fallback policy ở Program.cs.
public class ExamScheduleController : ControllerBase
{
    private readonly IExamScheduleService _service;
    private readonly IExamReminderService _reminders;

    public ExamScheduleController(IExamScheduleService service, IExamReminderService reminders)
    {
        _service = service;
        _reminders = reminders;
    }

    // Day 21: id các kỳ thi user đã đặt nhắc — để FE tô chuông đỏ.
    // Ba endpoint reminder chỉ dành cho học viên: CM/Admin không đi thi TOEIC thật.
    [HttpGet("my-reminders")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> GetMyReminders()
    {
        var ids = await _reminders.GetMyReminderExamIdsAsync();
        return Ok(ids);
    }

    // Day 21: đặt nhắc email — cần đăng nhập
    [HttpPost("{id:Guid}/reminder")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> SubscribeReminder(Guid id)
    {
        var result = await _reminders.SubscribeAsync(id);
        return result.IsSuccess
            ? Ok(new { message = "Đã đặt nhắc email (gửi trước ~3 ngày)." })
            : BadRequest(new { error = result.Error });
    }
    [HttpDelete("{id:Guid}/reminder")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> UnsubscribeReminder(Guid id)
    {
        var result = await _reminders.UnsubscribeAsync(id);
        return result.IsSuccess
            ? Ok(new { message = "Đã hủy nhắc." })
            : BadRequest(new { error = result.Error });
    }
    // ĐÃ BỎ: GET {id}/ical — export file .ics.
    //
    // Vì sao bỏ thay vì vá: nút Download đã gỡ khỏi UI từ trước (docs 12), nên endpoint
    // này là mã chết — không ai gọi, nhưng vẫn là bề mặt tấn công (iCal injection:
    // RegisterUrl chứa CRLF chèn được dòng lệnh iCal giả vào file). Bỏ hẳn là cách vá
    // rẻ nhất và chắc nhất: không có code thì không có lỗ hổng.
    //
    // Cần lại thì viết mới, nhớ escape MỌI field theo RFC 5545 (backslash trước, và
    // xóa cả \r chứ không chỉ escape \n).

    // Ai cũng xem được — Day 20 User UI lọc theo tỉnh/tháng
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetList(
        [FromQuery] string? city,
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] bool? isActive,
        [FromQuery] string? title,      // MỚI — Bài thi
        [FromQuery] string? location)   // MỚI — Địa điểm
    {
        var result = await _service.GetListAsync(city, month, year, isActive, title, location);
        return Ok(result);
    }

    [HttpGet("{id:Guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // Chỉ Admin / ContentManager nhập lịch thủ công từ IIG/BC
    [HttpPost]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Create(CreateExamScheduleRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateExamScheduleRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess
            ? Ok(new { message = "Đã cập nhật." })
            : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}
