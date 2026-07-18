namespace ToeicMasterPro.Application.DTOs.ExamSchedules;

// Body khi CM/Admin tạo lịch thi mới
public record CreateExamScheduleRequest(
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
    bool IsActive
);
