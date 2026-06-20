using Microsoft.AspNetCore.Identity;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Domain.Entities;

// Kế thừa IdentityUser để có sẵn: Id, Email, PasswordHash, EmailConfirmed...
// Chỉ thêm các field riêng của dự án
public class ApplicationUser : IdentityUser<Guid>
{
    public string FullName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public int TargetScore { get; set; } = 700;
    public DateTime? ExamDate { get; set; }
    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Free;
    public DateTime? PlanExpiryDate { get; set; }
    public int XpPoints { get; set; } = 0;
    public int StreakDays { get; set; } = 0;
    public DateTime? LastStudyDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<TestSession> TestSessions { get; set; } = [];
    public ICollection<UserVocabulary> UserVocabularies { get; set; } = [];
    public ICollection<UserExamReminder> ExamReminders { get; set; } = [];
}
