namespace ToeicMasterPro.Application.DTOs.Tests;

//Mục đích : Hiện thị chi tiết đề thi cùng danh sách câu hỏi kèm thứ tự
public record TestDetailResponse(
    Guid Id,
    string Title,
    string? Description,
    int DurationMinutes,
    bool IsPublished,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    List<TestQuestionItem> Questions
);

public record TestQuestionItem(
    Guid QuestionId,
    int OrderIndex,
    string Content,
    string Part
);