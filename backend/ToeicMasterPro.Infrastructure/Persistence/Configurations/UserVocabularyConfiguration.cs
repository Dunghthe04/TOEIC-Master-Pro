using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng UserVocabularies — theo dõi tiến trình học từng từ của từng user (SRS SM-2).
/// EaseFactor (2.5 mặc định): hệ số dễ — càng cao thì khoảng cách ôn tập càng dài.
/// IntervalDays: số ngày đến lần ôn tiếp theo.
/// NextReviewDate: ngày cần ôn — background job/frontend query cột này để hiển thị flashcard.
/// Unique (UserId + VocabularyId): mỗi user chỉ có 1 bản ghi SRS cho mỗi từ.
/// </summary>
public class UserVocabularyConfiguration : IEntityTypeConfiguration<UserVocabulary>
{
    public void Configure(EntityTypeBuilder<UserVocabulary> builder)
    {
        builder.HasKey(uv => uv.Id);

        // Mỗi user chỉ có 1 bản ghi SRS cho mỗi từ
        builder.HasIndex(uv => new { uv.UserId, uv.VocabularyId }).IsUnique();

        builder.Property(uv => uv.EaseFactor).HasDefaultValue(2.5f);
        builder.Property(uv => uv.IntervalDays).HasDefaultValue(1);
        builder.Property(uv => uv.NextReviewDate).HasDefaultValueSql("GETUTCDATE()");

        builder.HasOne(uv => uv.User)
            .WithMany(u => u.UserVocabularies)
            .HasForeignKey(uv => uv.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(uv => uv.Vocabulary)
            .WithMany(v => v.UserVocabularies)
            .HasForeignKey(uv => uv.VocabularyId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index để lấy danh sách từ cần ôn hôm nay
        builder.HasIndex(uv => new { uv.UserId, uv.NextReviewDate });
    }
}
