// Trả về báo cáo sau khi import — bao nhiêu câu thành công, bao nhiêu lỗi, lỗi ở hàng nào với lý do gì.
namespace ToeicMasterPro.Application.DTOs.Questions;

public record ImportResultResponse(
    int TotalRows,
    int SuccessCount,
    int FailedCount,
    List<ImportRowError> Errors,
    List<ImportQuestionCreatedItem> Created = null!
);

/// <summary>
/// Một dòng Excel đã tạo thành Question (hoặc SẼ tạo, khi chạy dryRun).
///
/// AudioFile/ImageFile mang theo TÊN FILE mà dòng đó tham chiếu, để bên gọi đối chiếu được
/// với nội dung gói ZIP trước khi ghi. Không có hai trường này thì không có cách nào biết
/// "câu 32 trỏ tới một file không nằm trong gói" — mà đó chính là lỗi làm câu mất tiếng.
/// </summary>
/// <param name="QuestionId">Guid.Empty khi chạy dryRun — chưa có gì được tạo.</param>
public record ImportQuestionCreatedItem(
    Guid QuestionId,
    int? OrderIndex,
    string? AudioFile = null,
    string? ImageFile = null
);

public record ImportRowError(
    int Row,
    string Reason
);