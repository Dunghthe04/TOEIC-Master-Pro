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
    public string Explanation { get; set; } = string.Empty; // gi?i th�ch d�p �n
    public string? AiExplanation { get; set; }            // AI gi?i th�ch (cache)
    public string[] Tags { get; set; } = [];              // ch? d?: Business, Travel...
    public bool IsPublished { get; set; } = false;

    public ICollection<QuestionOption> Options { get; set; } = [];
    public ICollection<TestQuestion> TestQuestions { get; set; } = [];
}
