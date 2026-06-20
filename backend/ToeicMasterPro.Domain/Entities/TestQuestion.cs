using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

// B?ng n?i Test <-> Question, gi? th�m th? t? c�u h?i trong d?
public class TestQuestion : BaseEntity
{
    public Guid TestId { get; set; }
    public Guid QuestionId { get; set; }
    public int OrderIndex { get; set; }   // th? t?: 1, 2, 3... 200

    public Test Test { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
