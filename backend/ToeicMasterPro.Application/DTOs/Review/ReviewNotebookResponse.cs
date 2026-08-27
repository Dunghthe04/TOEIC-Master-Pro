using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Review;

/// <summary>
/// SỔ TAY LỖI SAI — danh sách câu người học từng làm sai và chưa gỡ.
/// </summary>
/// <param name="Total">Tổng số câu chưa gỡ, KHÔNG phụ thuộc bộ lọc đang chọn.</param>
/// <param name="ByPart">
/// Số câu chưa gỡ theo từng Part — dựng thanh lọc mà không cần thêm một lượt gọi.
/// Cũng KHÔNG phụ thuộc bộ lọc: lọc sang Part 5 rồi mà thanh lọc chỉ còn Part 5 thì
/// người dùng không quay lại được chỗ cũ.
/// </param>
/// <param name="Items">Các câu của trang hiện tại.</param>
public record ReviewNotebookResponse(
    int Total,
    IReadOnlyList<ReviewPartCount> ByPart,
    IReadOnlyList<ReviewQuestionItem> Items
);

public record ReviewPartCount(int Part, int Count);

/// <summary>
/// Một câu trong sổ tay.
///
/// ─── KHÁC PlayQuestionItem Ở CHỖ CÓ ĐÁP ÁN ────────────────────────────────────────
///
/// <see cref="PlayQuestionItem"/> cố ý KHÔNG trả đáp án — lúc đang thi mà lộ đáp án qua
/// DevTools là hỏng cả bài. Ở đây thì ngược lại: người học đã làm xong, đã sai, và mục
/// đích của màn này là HIỂU vì sao. Giấu đáp án ở đây là giấu đúng thứ họ cần.
/// </summary>
/// <param name="CorrectOptionId">Phương án đúng.</param>
/// <param name="Explanation">Lời giải, có thể rỗng nếu đề chưa nhập.</param>
/// <param name="Transcript">Lời đoạn băng — Part 1–4.</param>
/// <param name="WrongCount">
/// Đã sai câu này bao nhiêu lần. Hiện ra để người học biết câu nào là điểm yếu dai dẳng,
/// và để xếp câu sai nhiều lần lên trước.
/// </param>
/// <param name="CorrectStreak">
/// Đang đúng liên tiếp mấy lần. Hiện dạng "1/2" để người học thấy mình sắp gỡ được câu —
/// một danh sách có thể vơi đi thì mới có người theo đuổi.
/// </param>
public record ReviewQuestionItem(
    Guid QuestionId,
    QuestionPart Part,
    string Content,
    string? AudioUrl,
    string? ImageUrl,
    string? Passage,
    IReadOnlyList<PlayOptionItem> Options,
    Guid CorrectOptionId,
    string? Explanation,
    string? Transcript,
    int WrongCount,
    int CorrectStreak,
    DateTime LastWrongAt
);

/// <summary>Người học trả lời một câu trong chế độ luyện lại.</summary>
/// <param name="SelectedOptionId">
/// Phương án đã chọn. KHÔNG cho null: bỏ trống trong lúc luyện lại không mang thông tin
/// gì — người học đang chủ động mở sổ tay ra làm, không phải đang hết giờ trong phòng thi.
/// </param>
public record AnswerReviewRequest(Guid SelectedOptionId);

/// <summary>Kết quả sau khi trả lời một câu trong sổ tay.</summary>
/// <param name="IsCorrect">Đúng hay sai.</param>
/// <param name="CorrectOptionId">Phương án đúng — để tô ngay, không phải gọi lại.</param>
/// <param name="CorrectStreak">Chuỗi đúng sau lần này.</param>
/// <param name="Resolved">Câu đã được gỡ khỏi sổ tay chưa.</param>
/// <param name="RemainingTotal">Còn lại bao nhiêu câu chưa gỡ — cập nhật số đếm tại chỗ.</param>
public record AnswerReviewResponse(
    bool IsCorrect,
    Guid CorrectOptionId,
    int CorrectStreak,
    bool Resolved,
    int RemainingTotal
);
