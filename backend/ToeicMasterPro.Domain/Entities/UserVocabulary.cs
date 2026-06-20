using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

// Thuật toán SM-2: mỗi user có lịch ôn tập riêng cho từng từ
public class UserVocabulary : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid VocabularyId { get; set; }

    // SM-2 fields
    public int RepetitionCount { get; set; } = 0;   // số lần đã ôn
    public float EaseFactor { get; set; } = 2.5f;   // hệ số dễ (2.5 mặc định)
    public int IntervalDays { get; set; } = 1;       // ôn lại sau bao nhiêu ngày
    public DateTime NextReviewDate { get; set; } = DateTime.UtcNow;
    public bool IsLearned { get; set; } = false;

    public ApplicationUser User { get; set; } = null!;
    public Vocabulary Vocabulary { get; set; } = null!;
}
