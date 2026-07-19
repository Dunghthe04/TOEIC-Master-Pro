using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.ExamSchedules;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] 
public class ExamScheduleController : ControllerBase
{
    private readonly IExamScheduleService _service;
    private readonly IExamReminderService _reminders;

    public ExamScheduleController(IExamScheduleService service, IExamReminderService reminders)
    {
        _service = service;
        _reminders = reminders;
    }

    // Day 21: id các kỳ thi user đã đặt nhắc — để FE tô chuông đỏ
    [HttpGet("my-reminders")]
    [Authorize]
    public async Task<IActionResult> GetMyReminders()
    {
        var ids = await _reminders.GetMyReminderExamIdsAsync();
        return Ok(ids);
    }

    // Day 21: đặt nhắc email — cần đăng nhập
    [HttpPost("{id:Guid}/reminder")]
    [Authorize]
    public async Task<IActionResult> SubscribeReminder(Guid id)
    {
        var result = await _reminders.SubscribeAsync(id);
        return result.IsSuccess
            ? Ok(new { message = "Đã đặt nhắc email (gửi trước ~3 ngày)." })
            : BadRequest(new { error = result.Error });
    }
    [HttpDelete("{id:Guid}/reminder")]
    [Authorize]
    public async Task<IActionResult> UnsubscribeReminder(Guid id)
    {
        var result = await _reminders.UnsubscribeAsync(id);
        return result.IsSuccess
            ? Ok(new { message = "Đã hủy nhắc." })
            : BadRequest(new { error = result.Error });
    }
    // Day 21: tải file .ics — public được (ai cũng export)
    [HttpGet("{id:Guid}/ical")]
    public async Task<IActionResult> ExportIcal(Guid id)
    {
        var result = await _service.GetIcalAsync(id);
        if (!result.IsSuccess)
            return NotFound(new { error = result.Error });
        var (fileName, content) = result.Value!;
        // text/calendar — trình duyệt / Google Calendar nhận diện
        return File(System.Text.Encoding.UTF8.GetBytes(content), "text/calendar", fileName);
    }
    // Ai cũng xem được — Day 20 User UI lọc theo tỉnh/tháng
    [HttpGet]
    public async Task<IActionResult> GetList(
        [FromQuery] string? city,
        [FromQuery] int? month,
        [FromQuery] int? year,
        [FromQuery] bool? isActive)
    {
        var result = await _service.GetListAsync(city, month, year, isActive);
        return Ok(result);
    }

    [HttpGet("{id:Guid}")]
    public async Task<IActionResult> GetDetail(Guid id)
    {
        var result = await _service.GetByIdAsync(id);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    // Chỉ Admin / ContentManager nhập lịch thủ công từ IIG/BC
    [HttpPost]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Create(CreateExamScheduleRequest req)
    {
        var result = await _service.CreateAsync(req);
        return result.IsSuccess
            ? CreatedAtAction(nameof(GetDetail), new { id = result.Value }, new { id = result.Value })
            : BadRequest(new { error = result.Error });
    }

    [HttpPut("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Update(Guid id, UpdateExamScheduleRequest req)
    {
        var result = await _service.UpdateAsync(id, req);
        return result.IsSuccess
            ? Ok(new { message = "Đã cập nhật." })
            : BadRequest(new { error = result.Error });
    }

    [HttpDelete("{id:Guid}")]
    [Authorize(Roles = "Admin,ContentManager")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return result.IsSuccess ? Ok() : BadRequest(new { error = result.Error });
    }
}
