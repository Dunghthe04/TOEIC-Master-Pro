using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Tests;

// Màn chọn Part
public record TestStructureResponse(
    Guid TestId,
    string Title,
    string Series,
    int DurationMinutes,
    List<PartStructureItem> Parts,
    int TotalQuestions
);

public record PartStructureItem(
    QuestionPart Part,
    string Name,      // "PART 1"
    int QuestionCount // "6 CÂU"
);