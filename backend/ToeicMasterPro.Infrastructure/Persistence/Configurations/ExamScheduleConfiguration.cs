using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Cấu hình bảng ExamSchedules — lịch thi TOEIC thật do admin cập nhật.
/// AvailableSlots: số chỗ còn lại — hiển thị cho user để biết còn đăng ký được không.
/// RegisterUrl: link đăng ký thi trên trang IIG/BC, redirect ra ngoài.
/// Fee lưu dạng decimal(18,0) vì tiền VNĐ không có số thập phân.
/// </summary>
public class ExamScheduleConfiguration : IEntityTypeConfiguration<ExamSchedule>
{
    public void Configure(EntityTypeBuilder<ExamSchedule> builder)
    {
        builder.HasKey(e => e.Id);
        builder.Property(e => e.Title).IsRequired().HasMaxLength(200);
        builder.Property(e => e.Organizer).IsRequired().HasMaxLength(100);
        builder.Property(e => e.Location).IsRequired().HasMaxLength(300);
        builder.Property(e => e.City).IsRequired().HasMaxLength(100);
        builder.Property(e => e.RegisterUrl).HasMaxLength(500);
        builder.Property(e => e.Fee).HasColumnType("decimal(18,0)");

        builder.HasMany(e => e.Reminders)
            .WithOne(r => r.ExamSchedule)
            .HasForeignKey(r => r.ExamScheduleId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index để filter lịch thi theo thành phố và ngày thi
        builder.HasIndex(e => new { e.City, e.ExamDate });
        builder.HasIndex(e => e.IsActive);
    }
}
