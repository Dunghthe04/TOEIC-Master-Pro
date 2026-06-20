using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng TestSessionAnswers — lưu câu trả lời của user trong mỗi lần thi.
/// SelectedOptionId nullable: null = user bỏ qua câu hỏi (không chọn đáp án).
/// IsCorrect được tính tại backend khi nộp bài, không để frontend tự tính.
/// Unique constraint (SessionId + QuestionId): mỗi câu hỏi chỉ có 1 câu trả lời/lần thi.
/// </summary>
public class TestSessionAnswerConfiguration : IEntityTypeConfiguration<TestSessionAnswer>
{
    public void Configure(EntityTypeBuilder<TestSessionAnswer> builder)
    {
        builder.HasKey(a => a.Id);

        // Mỗi câu hỏi chỉ có 1 câu trả lời trong 1 lần thi
        builder.HasIndex(a => new { a.SessionId, a.QuestionId }).IsUnique();

        // SelectedOptionId nullable = bỏ qua câu hỏi
        builder.Property(a => a.SelectedOptionId).IsRequired(false);

        builder.HasOne(a => a.Session)
            .WithMany(s => s.Answers)
            .HasForeignKey(a => a.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(a => a.Question)
            .WithMany()
            .HasForeignKey(a => a.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.SelectedOption)
            .WithMany()
            .HasForeignKey(a => a.SelectedOptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
