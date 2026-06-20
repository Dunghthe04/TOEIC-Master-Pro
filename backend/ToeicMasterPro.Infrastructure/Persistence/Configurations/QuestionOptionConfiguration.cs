using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng QuestionOptions — các lựa chọn A/B/C/D của mỗi câu hỏi.
/// Label giới hạn 1 ký tự ("A","B","C","D"). IsCorrect=true chỉ có 1 option trong mỗi câu.
/// Cascade delete: xóa Question → xóa luôn tất cả Options của câu đó.
/// </summary>
public class QuestionOptionConfiguration : IEntityTypeConfiguration<QuestionOption>
{
    public void Configure(EntityTypeBuilder<QuestionOption> builder)
    {
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Label).IsRequired().HasMaxLength(1);   // "A","B","C","D"
        builder.Property(o => o.Content).IsRequired().HasMaxLength(1000);
    }
}
