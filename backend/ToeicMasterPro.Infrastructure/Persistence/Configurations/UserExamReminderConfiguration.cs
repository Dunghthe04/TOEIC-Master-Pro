using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng UserExamReminders — user đăng ký nhận email nhắc nhở trước kỳ thi.
/// EmailSent=false: background job (Hangfire/Worker) sẽ gửi email và set true.
/// Unique (UserId + ExamScheduleId): mỗi user chỉ đăng ký 1 lần nhắc cho 1 kỳ thi.
/// Index (EmailSent + UserId): background job query WHERE EmailSent=false để batch gửi mail.
/// </summary>
public class UserExamReminderConfiguration : IEntityTypeConfiguration<UserExamReminder>
{
    public void Configure(EntityTypeBuilder<UserExamReminder> builder)
    {
        builder.HasKey(r => r.Id);

        // Mỗi user chỉ đăng ký nhắc nhở 1 lần cho 1 kỳ thi
        builder.HasIndex(r => new { r.UserId, r.ExamScheduleId }).IsUnique();

        builder.HasOne(r => r.User)
            .WithMany(u => u.ExamReminders)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.ExamSchedule)
            .WithMany(e => e.Reminders)
            .HasForeignKey(r => r.ExamScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index để background job query nhắc nhở chưa gửi
        builder.HasIndex(r => new { r.EmailSent, r.UserId });
    }
}
