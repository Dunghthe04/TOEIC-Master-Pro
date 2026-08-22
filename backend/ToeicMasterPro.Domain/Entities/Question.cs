using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Domain.Entities;

public class Question : BaseEntity
{
    public QuestionPart Part { get; set; }
    public DifficultyLevel Difficulty { get; set; } = DifficultyLevel.Medium;
    public string Content { get; set; } = string.Empty;  // n?i dung c�u h?i
    public string? AudioUrl { get; set; }                 // Part 1-4: file nghe
    public string? ImageUrl { get; set; }                 // Part 1: h�nh ?nh
    public string? Passage { get; set; }                  // Part 6-7: do?n van
    /// <summary>
    /// Lời đoạn băng (Part 1–4), quan trọng nhất ở Part 3–4.
    ///
    /// 3 câu cùng nhóm Part 3–4 LẶP cùng nội dung — chấp nhận có chủ ý: nhất quán với cách
    /// AudioUrl và Passage vốn đã lặp cho cả nhóm, và rẻ hơn nhiều so với tạo entity nhóm
    /// riêng (phải sửa import, cách gộp nhóm ở cả FE lẫn BE, và TestSessionService khi chấm).
    ///
    /// 🔴 CHỈ được trả về SAU KHI NỘP BÀI (payload review). TUYỆT ĐỐI không đưa vào
    /// PlayQuestionItem: đó là payload trả về trong lúc đang thi, nhét transcript vào là
    /// gửi nguyên lời đoạn băng xuống trình duyệt trước khi học viên nghe — mở DevTools là
    /// đọc thay vì nghe. Cùng họ lỗi với Day 34 (lộ IsCorrect) và Day 47 (máy tra đáp án).
    /// </summary>
    public string? Transcript { get; set; }

    public string Explanation { get; set; } = string.Empty; // gi?i th�ch d�p �n
    public string? AiExplanation { get; set; }            // AI gi?i th�ch (cache)
    public string[] Tags { get; set; } = [];              // ch? d?: Business, Travel...
    public bool IsPublished { get; set; } = false;

    public ICollection<QuestionOption> Options { get; set; } = [];
    public ICollection<TestQuestion> TestQuestions { get; set; } = [];
}
