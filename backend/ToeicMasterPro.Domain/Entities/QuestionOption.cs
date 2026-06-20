using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

public class QuestionOption : BaseEntity
{
    public Guid QuestionId { get; set; }
    public string Label { get; set; } = string.Empty;  // "A", "B", "C", "D"
    public string Content { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }

    public Question Question { get; set; } = null!;
}
