using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Questions;

public record UpdateQuestionRequest(
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