using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng Questions — kho câu hỏi trung tâm của hệ thống.
/// Mỗi câu hỏi thuộc 1 Part (1–7), có thể có audio/ảnh/bài đọc tùy Part.
/// AiExplanation cache giải thích từ Claude API để không gọi lại khi user khác xem cùng câu.
/// Tags lưu comma-separated (vd: "grammar,tense,part5") để filter nhanh không cần bảng phụ.
/// </summary>
public class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.HasKey(q => q.Id);
        builder.Property(q => q.Content).IsRequired().HasMaxLength(2000);
        builder.Property(q => q.AudioUrl).HasMaxLength(500);
        builder.Property(q => q.ImageUrl).HasMaxLength(500);
        builder.Property(q => q.Passage).HasMaxLength(5000);
        builder.Property(q => q.Explanation).HasMaxLength(3000);
        builder.Property(q => q.AiExplanation).HasMaxLength(5000);
        builder.Property(q => q.Part).HasConversion<int>();
        builder.Property(q => q.Difficulty).HasConversion<int>();

        // Tags lưu comma-separated: "grammar,tense,part5"
        builder.Property(q => q.Tags)
            .HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries))
            .HasMaxLength(500)
            .Metadata.SetValueComparer(new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<string[]>(
                (c1, c2) => c1!.SequenceEqual(c2!),
                c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
                c => c.ToArray()));

        // 1 Question có nhiều Options
        builder.HasMany(q => q.Options)
            .WithOne(o => o.Question)
            .HasForeignKey(o => o.QuestionId)
            .OnDelete(DeleteBehavior.Cascade); // xóa question → xóa luôn options

        // Index để lọc câu hỏi theo Part và độ khó nhanh
        builder.HasIndex(q => q.Part);
        builder.HasIndex(q => q.Difficulty);
        builder.HasIndex(q => q.IsPublished);
    }
}
