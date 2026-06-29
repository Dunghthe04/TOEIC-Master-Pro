namespace ToeicMasterPro.Application.DTOs.Tests;

//Mục đích: Gán nhiều câu hỏi vào đề cùng lúc, mỗi câu kèm OrderIndex để sắp thứ tự.
public record AddQuestionsRequest(
    List<QuestionOrderItem> Items
);

public record QuestionOrderItem(
    Guid QuestionId,
    int OrderIndex
);