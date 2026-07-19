using System.Text;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.ExamSchedules;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Services;

public class ExamScheduleService : IExamScheduleService
{
    private readonly IUnitOfWork _uow;

    public ExamScheduleService(IUnitOfWork uow) => _uow = uow;

    public async Task<IReadOnlyList<ExamScheduleResponse>> GetListAsync(
        string? city, int? month, int? year, bool? isActive)
    {
        // Mỗi filter chỉ áp dụng khi client gửi giá trị
        var list = await _uow.Repository<ExamSchedule>().FindAsync(e =>
            (city == null || e.City == city) &&
            (month == null || e.ExamDate.Month == month) &&
            (year == null || e.ExamDate.Year == year) &&
            (isActive == null || e.IsActive == isActive));

        return list.OrderBy(e => e.ExamDate).Select(Map).ToList();
    }

    public async Task<Result<ExamScheduleResponse>> GetByIdAsync(Guid id)
    {
        var entity = await _uow.Repository<ExamSchedule>().GetByIdAsync(id);
        if (entity is null)
            return Result<ExamScheduleResponse>.Failure("Không tìm thấy lịch thi.");
        return Result<ExamScheduleResponse>.Success(Map(entity));
    }

    public async Task<Result<Guid>> CreateAsync(CreateExamScheduleRequest req)
    {
        var err = Validate(req.Title, req.Organizer, req.Location, req.City,
            req.ExamDate, req.RegistrationDeadline, req.Fee);
        if (err is not null)
            return Result<Guid>.Failure(err);

        var entity = new ExamSchedule
        {
            Title = req.Title.Trim(),
            Organizer = req.Organizer.Trim(),
            Location = req.Location.Trim(),
            City = req.City.Trim(),
            ExamDate = req.ExamDate,
            StartTime = req.StartTime,
            RegistrationDeadline = req.RegistrationDeadline,
            Fee = req.Fee,
            AvailableSlots = req.AvailableSlots,
            RegisterUrl = req.RegisterUrl,
            IsActive = req.IsActive
        };

        await _uow.Repository<ExamSchedule>().AddAsync(entity);
        await _uow.SaveChangesAsync();
        return Result<Guid>.Success(entity.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, UpdateExamScheduleRequest req)
    {
        var err = Validate(req.Title, req.Organizer, req.Location, req.City,
            req.ExamDate, req.RegistrationDeadline, req.Fee);
        if (err is not null)
            return Result.Failure(err);

        var entity = await _uow.Repository<ExamSchedule>().GetByIdAsync(id);
        if (entity is null)
            return Result.Failure("Không tìm thấy lịch thi.");

        entity.Title = req.Title.Trim();
        entity.Organizer = req.Organizer.Trim();
        entity.Location = req.Location.Trim();
        entity.City = req.City.Trim();
        entity.ExamDate = req.ExamDate;
        entity.StartTime = req.StartTime;
        entity.RegistrationDeadline = req.RegistrationDeadline;
        entity.Fee = req.Fee;
        entity.AvailableSlots = req.AvailableSlots;
        entity.RegisterUrl = req.RegisterUrl;
        entity.IsActive = req.IsActive;
        entity.SetUpdatedAt();

        _uow.Repository<ExamSchedule>().Update(entity);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid id)
    {
        var entity = await _uow.Repository<ExamSchedule>().GetByIdAsync(id);
        if (entity is null)
            return Result.Failure("Không tìm thấy lịch thi.");

        // Cascade: xóa lịch → xóa UserExamReminders liên quan (Fluent API)
        _uow.Repository<ExamSchedule>().Remove(entity);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    private static string? Validate(
        string title, string organizer, string location, string city,
        DateTime examDate, DateTime deadline, decimal fee)
    {
        if (string.IsNullOrWhiteSpace(title)) return "Title không được trống.";
        if (string.IsNullOrWhiteSpace(organizer)) return "Organizer không được trống.";
        if (string.IsNullOrWhiteSpace(location)) return "Location không được trống.";
        if (string.IsNullOrWhiteSpace(city)) return "City không được trống.";
        if (fee < 0) return "Fee không được âm.";
        if (deadline > examDate) return "Hạn đăng ký phải trước hoặc bằng ngày thi.";
        return null;
    }

    // Day 21: sinh nội dung .ics (Google Calendar / Outlook mở được)
    public async Task<Result<(string FileName, string Content)>> GetIcalAsync(Guid id)
    {
        var e = await _uow.Repository<ExamSchedule>().GetByIdAsync(id);
        if (e is null)
            return Result<(string, string)>.Failure("Không tìm thấy lịch thi.");

        // UTC dạng 20260722T083000Z — lịch client tự convert timezone
        var start = e.ExamDate.Date.Add(e.StartTime);
        var end = start.AddHours(2); // TOEIC L&R ~2 giờ — ước lượng
        string Fmt(DateTime dt) => dt.ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'");

        var uid = $"{e.Id}@toeicmasterpro";
        var sb = new StringBuilder();
        sb.AppendLine("BEGIN:VCALENDAR");
        sb.AppendLine("VERSION:2.0");
        sb.AppendLine("PRODID:-//TOEIC Master Pro//Exam Schedule//VI");
        sb.AppendLine("CALSCALE:GREGORIAN");
        sb.AppendLine("METHOD:PUBLISH");
        sb.AppendLine("BEGIN:VEVENT");
        sb.AppendLine($"UID:{uid}");
        sb.AppendLine($"DTSTAMP:{Fmt(DateTime.UtcNow)}");
        sb.AppendLine($"DTSTART:{Fmt(start)}");
        sb.AppendLine($"DTEND:{Fmt(end)}");
        sb.AppendLine($"SUMMARY:{EscapeIcal(e.Title)}");
        sb.AppendLine($"LOCATION:{EscapeIcal($"{e.Location}, {e.City}")}");
        sb.AppendLine($"DESCRIPTION:{EscapeIcal($"{e.Organizer} — phí {e.Fee:N0}đ")}");
        if (!string.IsNullOrWhiteSpace(e.RegisterUrl))
            sb.AppendLine($"URL:{e.RegisterUrl}");
        sb.AppendLine("END:VEVENT");
        sb.AppendLine("END:VCALENDAR");

        var fileName = $"toeic-{e.ExamDate:yyyyMMdd}.ics";
        return Result<(string, string)>.Success((fileName, sb.ToString()));
    }

    private static string EscapeIcal(string s) =>
        s.Replace("\\", "\\\\").Replace(";", "\\;").Replace(",", "\\,").Replace("\n", "\\n");

    private static ExamScheduleResponse Map(ExamSchedule e) => new(
        e.Id, e.Title, e.Organizer, e.Location, e.City,
        e.ExamDate, e.StartTime, e.RegistrationDeadline,
        e.Fee, e.AvailableSlots, e.RegisterUrl, e.IsActive, e.CreatedAt
    );


}
