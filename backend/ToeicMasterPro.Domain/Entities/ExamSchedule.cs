using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

public class ExamSchedule : BaseEntity
{
    public string Title { get; set; } = string.Empty;       // "Thi TOEIC L&R"
    public string Organizer { get; set; } = string.Empty;   // "IIG", "British Council"
    public string Location { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string City { get; set; } = string.Empty;
    public DateTime ExamDate { get; set; }
    public TimeSpan StartTime { get; set; }
    public TimeSpan? EndTime { get; set; }
    public DateTime? RegistrationDeadline { get; set; }
    public decimal? Fee { get; set; }
    public int? AvailableSlots { get; set; }
    public string? RegisterUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public string? ExternalId { get; set; }
    public string? ExternalSource { get; set; }
    public DateTime? ResultDate { get; set; }

    public ICollection<UserExamReminder> Reminders { get; set; } = [];
}
