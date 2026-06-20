using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

// Lưu đáp án từng câu của user trong 1 phiên thi
public class TestSessionAnswer : BaseEntity
{
    public Guid SessionId { get; set; }
    public Guid QuestionId { get; set; }
    public Guid? SelectedOptionId { get; set; }  // null = b? qua
    public bool IsCorrect { get; set; }

    public TestSession Session { get; set; } = null!;
    public Question Question { get; set; } = null!;
    public QuestionOption? SelectedOption { get; set; }
}
