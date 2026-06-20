using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

public class UserExamReminder : BaseEntity
{
    public Guid UserId { get; set; } // id của user đăng ký
    public Guid ExamScheduleId { get; set; } // id của lịch thi đăng ký
    public bool EmailSent { get; set; } = false; // trạng thái đã gửi email nhắc nhở

    public ApplicationUser User { get; set; } = null!;// user đăng ký
    public ExamSchedule ExamSchedule { get; set; } = null!;// lịch thi
}
