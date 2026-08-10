using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Domain.Entities;

public class TestSession : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid TestId { get; set; }
    public TestSessionStatus Status { get; set; } = TestSessionStatus.InProgress;
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    //Thời gian bắt đầu reading -> để biết được còn bao nhiêu thời gian
    public DateTime? ReadingStartedAt {get;set;}
    public DateTime? CompletedAt { get; set; }

    /// <summary>
    /// Part user chọn lúc bắt đầu — "1,2,5" hoặc null = full đề.
    /// Dùng khi chấm điểm: chỉ tính câu thuộc các Part này.
    /// </summary>
    public string? PartsFilter { get; set; }

    // Kết quả sau khi nộp bài
    public int? ListeningScore { get; set; }   // 5-495
    public int? ReadingScore { get; set; }     // 5-495
    public int? TotalScore { get; set; }       // 10-990
    public int? CorrectCount { get; set; }
    public int? TotalCount { get; set; }

    public ApplicationUser User { get; set; } = null!;
    public Test Test { get; set; } = null!;
    public ICollection<TestSessionAnswer> Answers { get; set; } = [];
}
