using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Bảng PracticeSessions — mỗi lượt luyện tập của một user.
/// OnDelete Restrict giống TestSession: xóa user không xóa lịch sử luyện.
/// </summary>
public class PracticeSessionConfiguration : IEntityTypeConfiguration<PracticeSession>
{
    public void Configure(EntityTypeBuilder<PracticeSession> builder)
    {
        builder.HasKey(s => s.Id);

        // 50 câu × 37 ký tự (guid + phẩy) ≈ 1850. Để nvarchar(max) cho khỏi phải
        // đoán trần — cột này chỉ đọc nguyên khối, không index, không so sánh.
        builder.Property(s => s.QuestionIds).IsRequired();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Truy vấn nóng duy nhất: "phiên này có phải của user đang gọi không".
        // Đi kèm SubmittedAt để lọc phiên chưa nộp mà không phải chạm bảng dữ liệu.
        builder.HasIndex(s => new { s.UserId, s.SubmittedAt });
    }
}
