using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Tests;

// Gói thi — KHÔNG có IsCorrect / Explanation
public record TestPlayResponse(
    Guid TestId,
    string Title,
    string Series,
    int DurationMinutes,
    List<PlayPartDirections> Directions, // intro theo Part có trong bài
    List<PlayQuestionItem> Questions
);

public record PlayPartDirections(
    QuestionPart Part,
    string ImageUrl,
    string? AudioUrl
);

public record PlayQuestionItem(
    Guid QuestionId,
    int OrderIndex,
    QuestionPart Part,
    string Content,
    string? AudioUrl,
    string? ImageUrl,
    string? Passage,
    List<PlayOptionItem> Options
);

public record PlayOptionItem(
    Guid Id,
    string Label,   // A/B/C/D
    string Content
// không có IsCorrect
);