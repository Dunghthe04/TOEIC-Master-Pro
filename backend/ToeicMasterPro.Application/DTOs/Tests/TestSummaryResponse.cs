namespace ToeicMasterPro.Application.DTOs.Tests;

//Mục đích : Rút gọn dữ liệu dùng cho list view / table (vì không cần chi tiết câu hỏi)
public record TestSummaryResponse(
    Guid Id,
    string Title,
    string? Description,
    int DurationMinutes,
    bool IsPublished,
    int QuestionCount,
    Guid CreatedByUserId,
    DateTime CreatedAt
);