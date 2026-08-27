using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;

/// <summary>
/// Bảng UserQuestionReviews — sổ tay lỗi sai của từng người học.
/// </summary>
public class UserQuestionReviewConfiguration : IEntityTypeConfiguration<UserQuestionReview>
{
    public void Configure(EntityTypeBuilder<UserQuestionReview> builder)
    {
        builder.HasKey(r => r.Id);

        // Mỗi user chỉ có MỘT dòng cho mỗi câu.
        //
        // Ràng buộc này là thứ giữ cho sổ tay không phình: sai câu 104 năm lần thì vẫn là
        // một dòng với WrongCount = 5, không phải năm dòng. Đặt ở tầng DB chứ không chỉ
        // trong code — mã ghi có thể chạy song song từ hai request nộp bài.
        builder.HasIndex(r => new { r.UserId, r.QuestionId }).IsUnique();

        // Truy vấn chính của cả tính năng: "câu chưa gỡ của tôi, mới sai xếp trước".
        // Không có chỉ mục này thì mỗi lần mở sổ tay là quét toàn bảng.
        builder.HasIndex(r => new { r.UserId, r.IsResolved, r.LastWrongAt });

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // 🔴 Restrict, KHÔNG Cascade: xoá một câu hỏi khỏi kho không được phép kéo theo
        // lịch sử học của người dùng. Nếu thật sự cần xoá câu thì phải xử lý sổ tay trước
        // — và lỗi khoá ngoại lúc đó chính là lời nhắc rằng có dữ liệu đang treo vào nó.
        //
        // Đây cũng là cách tránh nhiều đường xoá dây chuyền chạm cùng một bảng, thứ mà
        // SQL Server từ chối thẳng.
        builder.HasOne(r => r.Question)
            .WithMany()
            .HasForeignKey(r => r.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
