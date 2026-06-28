using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Questions;

public record QuestionResponse(
    Guid Id,
    QuestionPart Part,
    DifficultyLevel Difficulty,
    string Content,
    string Explanation,
    string? AudioUrl,
    string? ImageUrl,
    string? Passage,
    string[] Tags,
    bool IsPublished,
    List<OptionResponse> Options
);

public record OptionResponse(Guid Id, string Label, string Content, bool IsCorrect);
