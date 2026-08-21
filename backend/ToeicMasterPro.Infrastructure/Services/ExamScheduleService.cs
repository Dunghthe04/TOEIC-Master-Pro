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
     string? city, int? month, int? year, bool? isActive, string? title, string? location)
    {
        // Mỗi filter chỉ áp dụng khi client gửi giá trị
        var list = await _uow.Repository<ExamSchedule>().FindAsync(e =>
            (city == null || e.City == city) &&
            (month == null || e.ExamDate.Month == month) &&
            (year == null || e.ExamDate.Year == year) &&
            (isActive == null || e.IsActive == isActive) &&
            (title == null || e.Title == title) &&
            (location == null || e.Location == location));

        return list.OrderBy(e => e.ExamDate).Select(Map).ToList();
    }

    public async Task<Result<ExamScheduleResponse>> GetByIdAsync(Guid id)
    {
        var entity = await _uow.Repository<ExamSchedule>().GetByIdAsync(id);
        if (entity is null)
            return Result<ExamScheduleResponse>.NotFound("Không tìm thấy lịch thi.");
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
            return Result.NotFound("Không tìm thấy lịch thi.");

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
            return Result.NotFound("Không tìm thấy lịch thi.");

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

    // ĐÃ BỎ: GetIcalAsync + EscapeIcal + IsSafeHttpUrl (export file .ics).
    //
    // Nút Download đã gỡ khỏi UI từ trước (docs 12) nên đây là mã chết — không ai gọi,
    // nhưng vẫn là bề mặt tấn công: RegisterUrl ghi thẳng vào file .ics mà không escape,
    // URL chứa CRLF là chèn được dòng lệnh iCal giả (ghi đè DESCRIPTION, thêm VEVENT)
    // → user import vào Google Calendar thấy nội dung lừa đảo trông như hệ thống gửi.
    //
    // Bỏ hẳn thay vì vá: rẻ hơn và chắc hơn — không có code thì không có lỗ hổng.
    // Cần lại thì viết mới, escape MỌI field theo RFC 5545 §3.3.11 (backslash thay
    // TRƯỚC, và xóa cả \r chứ không chỉ escape \n — nhiều parser coi \r đơn lẻ là hết dòng).

    private static ExamScheduleResponse Map(ExamSchedule e) => new(
        e.Id, e.Title, e.Organizer, e.Location, e.Address, e.City,
        e.ExamDate, e.StartTime, e.RegistrationDeadline,
        e.Fee, e.AvailableSlots, e.RegisterUrl, e.IsActive, e.CreatedAt,
        e.EndTime, e.ResultDate
    );


}
