using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

/// <summary>
/// Một câu nằm trong SỔ TAY LỖI SAI của một người học.
///
/// ─── VÌ SAO CẦN BẢNG RIÊNG ──────────────────────────────────────────────────────────
///
/// Danh sách câu sai vốn suy được từ <see cref="TestSessionAnswer"/> — khối "HÔM NAY"
/// đang làm đúng như vậy. Nhưng suy ra thì chỉ ĐỌC được, không GHI được, mà sổ tay cần
/// ghi lại ba thứ không tồn tại trong bảng trả lời:
///
///   1. Luyện lại đúng mấy lần rồi  (<see cref="CorrectStreak"/>)
///   2. Người học tự đánh dấu "đã hiểu"  (<see cref="IsResolved"/>)
///   3. Sai bao nhiêu lần tất cả  (<see cref="WrongCount"/>) — để xếp câu sai nhiều lên trước
///
/// Từ khi có bảng này, nó là NGUỒN DUY NHẤT cho "câu tôi làm sai". Khối HÔM NAY cũng
/// chuyển sang đọc ở đây — hai nơi đếm theo hai cách rồi sẽ lệch nhau, và lúc đó không ai
/// biết con số nào đúng.
///
/// ─── VÀO / RA SỔ TAY ────────────────────────────────────────────────────────────────
///
///   VÀO  chọn một phương án nhưng chọn SAI, ở bất kỳ phiên thi nào.
///        🔴 KHÔNG tính câu bỏ trống. Dữ liệu thật: 2.300 câu trả lời thì 2.085 bỏ trống,
///        gần như toàn bộ từ những lần nộp bài trắng. Gộp vào thì sổ tay có hơn hai nghìn
///        câu ngay ngày đầu — không ai mở một danh sách như vậy.
///        Về bản chất cũng khác: chọn sai là LỖI SAI (tưởng đúng mà không đúng), bỏ trống
///        là KHOẢNG TRỐNG (hết giờ, chưa làm tới).
///
///   RA   trả lời đúng <see cref="ResolveStreak"/> lần LIÊN TIẾP ở chế độ luyện lại,
///        hoặc người học tự bấm "Đã hiểu".
///
///   QUAY LẠI  sai lại thì <see cref="CorrectStreak"/> về 0 và <see cref="IsResolved"/>
///        về false. Đã gỡ rồi mà sai lại thì rõ ràng là chưa thật sự hiểu.
/// </summary>
public class UserQuestionReview : BaseEntity
{
    /// <summary>
    /// Số lần đúng LIÊN TIẾP cần có để câu tự rời sổ tay.
    ///
    /// Hai, không phải một: đoán mò một câu bốn phương án trúng 25% — một lần đúng chưa
    /// chứng minh được gì. Hai lần liên tiếp thì xác suất đoán mò còn ~6%.
    ///
    /// Không đặt cao hơn: sổ tay phải VƠI ĐI được, nếu không nó chỉ phình ra và người học
    /// bỏ cuộc. Ba lần là bắt luyện một câu đã hiểu thêm một lượt nữa mà không đổi gì.
    /// </summary>
    public const int ResolveStreak = 2;

    public Guid UserId { get; set; }
    public Guid QuestionId { get; set; }

    /// <summary>Tổng số lần đã trả lời sai câu này — kể cả trong thi thử lẫn luyện lại.</summary>
    public int WrongCount { get; set; }

    /// <summary>
    /// Chuỗi trả lời đúng liên tiếp GẦN NHẤT. Sai một lần là về 0.
    /// Đạt <see cref="ResolveStreak"/> thì câu được gỡ khỏi sổ tay.
    /// </summary>
    public int CorrectStreak { get; set; }

    /// <summary>
    /// Đã gỡ khỏi sổ tay chưa. Không xoá dòng khi gỡ — giữ lại để biết câu này TỪNG sai,
    /// và để nếu sai lại thì <see cref="WrongCount"/> tiếp tục cộng dồn chứ không đếm lại.
    /// </summary>
    public bool IsResolved { get; set; }

    /// <summary>Lần sai gần nhất — dùng để xếp câu mới sai lên đầu.</summary>
    public DateTime LastWrongAt { get; set; } = DateTime.UtcNow;

    public ApplicationUser User { get; set; } = null!;
    public Question Question { get; set; } = null!;
}
