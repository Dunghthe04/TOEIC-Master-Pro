using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng AspNetUsers (mở rộng từ ASP.NET Identity).
/// ApplicationUser kế thừa IdentityUser nên các cột cơ bản (Id, Email, PasswordHash...)
/// đã được Identity tự tạo — ta chỉ cần cấu hình thêm các cột tùy chỉnh.
/// </summary>
public class UserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.FullName).IsRequired().HasMaxLength(100);
        builder.Property(u => u.AvatarUrl).HasMaxLength(500);
        builder.Property(u => u.TargetScore).HasDefaultValue(700);
        builder.Property(u => u.Plan).HasConversion<int>();
        builder.Property(u => u.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

        // Index để tìm kiếm user nhanh
        builder.HasIndex(u => u.Email);
        builder.HasIndex(u => u.Plan);
    }
}
