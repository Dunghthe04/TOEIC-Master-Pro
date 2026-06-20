using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng TestSessions — ghi lại mỗi lần user làm bài thi.
/// Status: InProgress(1) → Completed(2) hoặc Abandoned(3).
/// ListeningScore + ReadingScore mỗi thang 5–495, TotalScore = tổng = 10–990.
/// OnDelete Restrict: xóa User/Test không xóa lịch sử thi (dữ liệu lịch sử cần giữ).
/// Answers cascade: xóa Session → xóa luôn tất cả câu trả lời của session đó.
/// </summary>
public class TestSessionConfiguration : IEntityTypeConfiguration<TestSession>
{
    public void Configure(EntityTypeBuilder<TestSession> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Status).HasConversion<int>();
        builder.Property(s => s.StartedAt).HasDefaultValueSql("GETUTCDATE()");

        // Nhiều Session thuộc 1 User
        builder.HasOne(s => s.User)
            .WithMany(u => u.TestSessions)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict); // không xóa session khi xóa user

        // Nhiều Session thuộc 1 Test
        builder.HasOne(s => s.Test)
            .WithMany(t => t.Sessions)
            .HasForeignKey(s => s.TestId)
            .OnDelete(DeleteBehavior.Restrict);

        // Nhiều Answer thuộc 1 Session
        builder.HasMany(s => s.Answers)
            .WithOne(a => a.Session)
            .HasForeignKey(a => a.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index để lấy lịch sử thi của user nhanh
        builder.HasIndex(s => new { s.UserId, s.Status });
        builder.HasIndex(s => s.CompletedAt);
    }
}
