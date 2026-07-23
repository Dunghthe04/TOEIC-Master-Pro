// Trả về báo cáo sau khi import — bao nhiêu câu thành công, bao nhiêu lỗi, lỗi ở hàng nào với lý do gì.
namespace ToeicMasterPro.Application.DTOs.Questions;

public record ImportResultResponse(
    int TotalRows,
    int SuccessCount,
    int FailedCount,
    List<ImportRowError> Errors,
    List<ImportQuestionCreatedItem> Created = null!
);

public record ImportQuestionCreatedItem(
    Guid QuestionId,
    int? OrderIndex
);

public record ImportRowError(
    int Row,
    string Reason
);