namespace ToeicMasterPro.Application.DTOs.ExamSchedules;

// Body khi CM/Admin cập nhật lịch thi — cùng field với Create
public record UpdateExamScheduleRequest(
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
