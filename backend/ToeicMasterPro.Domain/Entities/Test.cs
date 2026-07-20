using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

public class Test : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DurationMinutes { get; set; } = 120;   // m?c d?nh 120 ph�t nhu TOEIC th?t
    public bool IsPublished { get; set; } = false;
    public string Series { get; set; } = string.Empty; // vd: "ETS 2026", "HACKER TOEIC 3"
    public Guid CreatedByUserId { get; set; }         // Content Manager t?o

    public ICollection<TestQuestion> TestQuestions { get; set; } = [];
    public ICollection<TestSession> Sessions { get; set; } = [];
}
