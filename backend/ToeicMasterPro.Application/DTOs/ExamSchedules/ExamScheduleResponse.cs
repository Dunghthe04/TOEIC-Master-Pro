namespace ToeicMasterPro.Application.DTOs.ExamSchedules;

// Dữ liệu trả về khi GET list / detail — không lộ navigation Reminders
public record ExamScheduleResponse(
    Guid Id,
    string Title,
    string Organizer,
    string Location,
    string City,
    DateTime ExamDate,
    TimeSpan StartTime,
    DateTime RegistrationDeadline,
    decimal Fee,
    int? AvailableSlots,
    string? RegisterUrl,
    bool IsActive,
    DateTime CreatedAt
);
