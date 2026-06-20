using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng Vocabularies — kho từ vựng TOEIC do admin/content manager nhập.
/// Definition là nghĩa tiếng Việt, DefinitionEn là nghĩa tiếng Anh (tùy chọn).
/// Topic phân loại chủ đề (Business, Finance, Travel...) theo enum VocabTopic.
/// Word có unique index: không được trùng từ trong kho từ vựng.
/// </summary>
public class VocabularyConfiguration : IEntityTypeConfiguration<Vocabulary>
{
    public void Configure(EntityTypeBuilder<Vocabulary> builder)
    {
        builder.HasKey(v => v.Id);
        builder.Property(v => v.Word).IsRequired().HasMaxLength(100);
        builder.Property(v => v.Phonetic).HasMaxLength(200);
        builder.Property(v => v.Definition).IsRequired().HasMaxLength(500);
        builder.Property(v => v.DefinitionEn).HasMaxLength(500);
        builder.Property(v => v.ExampleSentence).HasMaxLength(500);
        builder.Property(v => v.AudioUrl).HasMaxLength(500);
        builder.Property(v => v.WordType).HasMaxLength(20);
        builder.Property(v => v.Topic).HasConversion<int>();

        builder.HasIndex(v => v.Word).IsUnique(); // không trùng từ
        builder.HasIndex(v => v.Topic);
    }
}
