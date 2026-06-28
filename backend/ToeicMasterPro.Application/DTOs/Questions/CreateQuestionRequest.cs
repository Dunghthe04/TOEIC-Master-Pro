using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Questions;

public record CreateQuestionRequest(
    QuestionPart Part,
    DifficultyLevel Difficulty,
    string Content,
    string Explanation,
    string? AudioUrl,
    string? ImageUrl,
    string? Passage,
    string[] Tags,
    bool IsPublished,
    List<CreateOptionRequest> Options
);

public record CreateOptionRequest(string Label, string Content, bool IsCorrect);
