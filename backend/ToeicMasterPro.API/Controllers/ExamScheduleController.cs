using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.ExamSchedules;

namespace ToeicMasterPro.API.Controllers;

[ApiController]
[Route("api/[controller]")] // → /api/examschedule
public class ExamScheduleController : ControllerBase
{
    private readonly IExamScheduleService _service;

    public ExamScheduleController(IExamScheduleService service) => _service = service;

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
