using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng Tests — đề thi được content manager tạo ra.
/// Mỗi đề thi có nhiều câu hỏi thông qua bảng trung gian TestQuestions (quan hệ N-N).
/// DurationMinutes mặc định 120 phút (đúng chuẩn TOEIC full test).
/// IsPublished=false → đề nháp, chỉ admin/content manager thấy.
/// </summary>
public class TestConfiguration : IEntityTypeConfiguration<Test>
{
    public void Configure(EntityTypeBuilder<Test> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Title).IsRequired().HasMaxLength(200);
        builder.Property(t => t.Description).HasMaxLength(1000);
        builder.Property(t => t.DurationMinutes).HasDefaultValue(120);
        builder.Property(t => t.Series).HasMaxLength(100);
        builder.HasIndex(t => t.Series);

        // 1 Test có nhiều TestQuestion (bảng nối)
        builder.HasMany(t => t.TestQuestions)
            .WithOne(tq => tq.Test)
            .HasForeignKey(tq => tq.TestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.IsPublished);
        builder.HasIndex(t => t.CreatedByUserId);
    }
}
