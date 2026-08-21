using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs");
        builder.HasKey(x => x.Id);

        // KHÔNG có HasOne(x => x.User): entity này cố ý không có navigation sang
        // ApplicationUser. Log phải sống sót cả khi tài khoản liên quan bị xoá — có FK
        // thì hoặc xoá user làm mất log (Cascade), hoặc không xoá được user (Restrict).
        // Danh tính lưu dạng chữ trong ActorEmail/TargetLabel, chụp tại thời điểm đó.

        builder.Property(x => x.Category).HasConversion<int>();

        builder.Property(x => x.ActorEmail).IsRequired().HasMaxLength(256);
        builder.Property(x => x.Action).IsRequired().HasMaxLength(64);
        builder.Property(x => x.TargetType).IsRequired().HasMaxLength(32);
        builder.Property(x => x.TargetLabel).IsRequired().HasMaxLength(256);
        builder.Property(x => x.Detail).HasMaxLength(1000);

        // 45 ký tự đủ cho IPv6 dạng dài nhất (39) kể cả bản IPv4-mapped
        // ("::ffff:192.168.1.1"). Đặt 45 để không phải nghĩ lại.
        builder.Property(x => x.IpAddress).HasMaxLength(45);

        // Index chính: mọi truy vấn đều "log mới nhất trước" và lọc theo khoảng ngày.
        // Giảm dần để khỏi phải sort ngược.
        builder.HasIndex(x => x.CreatedAt).IsDescending();

        // Cho AuditLogCleanupJob (HM-5): xoá theo Category + CreatedAt. Không có index
        // này thì job dọn quét toàn bảng — đúng lúc bảng đang to nhất.
        builder.HasIndex(x => new { x.Category, x.CreatedAt });

        // Cho bộ lọc trên UI (HM-4) và câu "tài khoản này đã bị làm những gì".
        builder.HasIndex(x => x.Action);
        builder.HasIndex(x => x.TargetId);
    }
}
