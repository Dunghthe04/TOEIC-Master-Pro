using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng trung gian TestQuestions — nối Test với Question (quan hệ nhiều-nhiều).
/// OrderIndex quy định thứ tự câu hỏi trong đề thi.
/// Unique constraint (TestId + QuestionId): 1 câu hỏi chỉ xuất hiện 1 lần trong 1 đề.
/// Khi xóa Test → cascade xóa TestQuestion nhưng KHÔNG xóa Question gốc (Restrict).
/// </summary>
public class TestQuestionConfiguration : IEntityTypeConfiguration<TestQuestion>
{
    public void Configure(EntityTypeBuilder<TestQuestion> builder)
    {
        builder.HasKey(tq => tq.Id);

        // Mỗi câu hỏi chỉ xuất hiện 1 lần trong 1 đề thi
        builder.HasIndex(tq => new { tq.TestId, tq.QuestionId }).IsUnique();

        builder.HasOne(tq => tq.Test)
            .WithMany(t => t.TestQuestions)
            .HasForeignKey(tq => tq.TestId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(tq => tq.Question)
            .WithMany(q => q.TestQuestions)
            .HasForeignKey(tq => tq.QuestionId)
            .OnDelete(DeleteBehavior.Restrict); // xóa Test không xóa Question
    }
}
