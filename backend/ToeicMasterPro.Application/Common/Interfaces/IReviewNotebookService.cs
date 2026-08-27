using ToeicMasterPro.Application.DTOs.Review;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

/// <summary>
/// Sổ tay lỗi sai — nơi chứa những câu người học từng làm sai và chưa gỡ.
///
/// Thay cho màn "Luyện nhanh" cũ. Khác biệt cốt lõi không nằm ở giao diện: "Luyện nhanh"
/// là một HÀNH ĐỘNG (phải tự chọn Part, độ khó, số câu rồi mới có gì để làm), còn sổ tay
/// là một NƠI CHỐN — mở ra là đã có sẵn nội dung, không phải quyết định gì.
/// </summary>
public interface IReviewNotebookService
{
    /// <summary>
    /// Danh sách câu chưa gỡ.
    /// </summary>
    /// <param name="part">Lọc theo Part 1–7. null = tất cả.</param>
    /// <param name="testId">Lọc theo đề. null = mọi đề.</param>
    /// <param name="skip">Bỏ qua bao nhiêu câu — phân trang.</param>
    /// <param name="take">Lấy bao nhiêu câu.</param>
    Task<Result<ReviewNotebookResponse>> GetAsync(
        Guid userId, int? part, Guid? testId, int skip, int take);

    /// <summary>
    /// Ghi lại một lần trả lời trong chế độ luyện lại.
    ///
    /// Đúng thì tăng chuỗi, đủ ngưỡng thì gỡ câu. Sai thì đặt lại chuỗi về 0 và cộng
    /// <c>WrongCount</c> — cùng quy tắc như khi làm sai trong bài thi thật.
    /// </summary>
    Task<Result<AnswerReviewResponse>> AnswerAsync(Guid userId, Guid questionId, Guid selectedOptionId);

    /// <summary>
    /// Người học tự bấm "Đã hiểu" — gỡ ngay, không cần đúng đủ số lần.
    ///
    /// Có nút này vì người học biết rõ hơn máy: có câu chỉ sai vì bấm nhầm, luyện lại hai
    /// lần nữa là phí thời gian. Không cho tự gỡ thì họ sẽ bỏ qua cả sổ tay.
    /// </summary>
    Task<Result<int>> ResolveAsync(Guid userId, Guid questionId);
}
