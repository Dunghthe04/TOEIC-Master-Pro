namespace ToeicMasterPro.Application.DTOs.Dashboard;

/// <summary>
/// Khối "HÔM NAY" trên Dashboard — trả lời câu hỏi duy nhất người học mở web lên để hỏi:
/// <i>"hôm nay tôi làm gì?"</i>
///
/// ─── VÌ SAO GỘP THÀNH MỘT ENDPOINT ─────────────────────────────────────────────────
///
/// Bốn dòng của khối này đến từ bốn nguồn khác nhau: câu sai lấy từ TestSessionAnswers,
/// thẻ từ lấy từ UserVocabularies, lịch thi lấy từ TestSessions, mục tiêu lấy từ hồ sơ.
/// Để client tự ghép thì thành 4 lượt gọi cho MỘT khối giao diện — và khối đó nằm ngay
/// đầu trang, tức là 4 lượt chờ trước khi người dùng thấy được gì.
///
/// Đây là DTO phục vụ một khối màn hình cụ thể, không phải mô hình nghiệp vụ. Đổi bố cục
/// khối đó thì đổi luôn DTO này — chấp nhận, vì nó chỉ có một nơi dùng.
///
/// ─── NGUYÊN TẮC: KHÔNG BAO GIỜ TRẢ VỀ MÀN HÌNH RỖNG ────────────────────────────────
///
/// Người dùng mới tinh (0 phiên thi, 0 câu sai, 0 thẻ từ) vẫn phải nhận được MỘT việc để
/// làm. Nên khi mọi con số đều bằng 0, <see cref="SuggestedTestId"/> vẫn có giá trị —
/// "thi một đề đi" là hành động khởi đầu hợp lý duy nhất.
/// </summary>
/// <param name="TargetScore">Mục tiêu trong hồ sơ. Mặc định 700 nếu người dùng chưa đặt.</param>
/// <param name="LatestScore">
/// Điểm lần thi gần nhất, hoặc null nếu chưa thi lần nào. Chỉ tính phiên FULL — so một
/// phiên chỉ làm Part 5 với thang 990 là so sai.
/// </param>
/// <param name="ExamDate">Ngày thi thật người dùng khai. Null = chưa khai.</param>
/// <param name="WeeksLeft">
/// Số tuần còn lại tới ngày thi, làm tròn lên. Null khi chưa khai ngày thi.
/// Làm tròn LÊN vì "còn 0 tuần" đọc ra như đã hết hạn, trong khi vẫn còn vài ngày.
/// </param>
/// <param name="WrongTotal">
/// Số câu ĐÃ CHỌN nhưng chọn sai, tính theo lần làm GẦN NHẤT của mỗi câu.
///
/// 🔴 KHÔNG TÍNH CÂU BỎ TRỐNG, và đây là quyết định có cân nhắc. Dữ liệu thật hiện tại:
/// 2.300 câu trả lời thì 2.085 câu bỏ trống — gần như toàn bộ đến từ những lần nộp bài
/// trắng lúc kiểm thử. Gộp chúng vào thì khối "HÔM NAY" hiện "2.203 câu từng làm sai",
/// một con số vừa vô dụng vừa làm người học nản ngay từ dòng đầu.
///
/// Về bản chất cũng khác nhau: câu chọn sai là một LỖI SAI (bạn tưởng đúng mà không đúng),
/// còn câu bỏ trống là một KHOẢNG TRỐNG (hết giờ, hoặc chưa làm tới). Sổ tay lỗi sai nên
/// bắt đầu từ loại thứ nhất.
///
/// Câu bỏ trống vẫn được đếm riêng ở <paramref name="SkippedTotal"/> — không giấu đi.
/// </param>
/// <param name="WrongByPart">Phân bố câu sai theo Part — để hiện "Part 5 · 12 câu".</param>
/// <param name="SkippedTotal">
/// Số câu bỏ trống ở lần làm gần nhất. Trả về để giao diện tự quyết có dùng hay không, và
/// để không âm thầm vứt mất một phần dữ liệu.
/// </param>
/// <param name="VocabDue">Số thẻ từ đến hạn ôn hôm nay.</param>
/// <param name="TestedThisWeek">
/// Đã nộp bài nào trong tuần này chưa (tính từ thứ Hai). Dùng để nhắc "chưa thi đề nào
/// tuần này" — một lời nhắc chỉ có nghĩa khi nó ĐÚNG, nên phải tính theo tuần lịch chứ
/// không phải 7 ngày gần nhất.
/// </param>
/// <param name="SuggestedTestId">Đề đề nghị thi tiếp — đề đã xuất bản mà người dùng chưa hoàn thành.</param>
/// <param name="SuggestedTestTitle">Tên đề đó, để hiện thẳng trên nút.</param>
public record TodayPlanResponse(
    int TargetScore,
    int? LatestScore,
    DateTime? ExamDate,
    int? WeeksLeft,
    int WrongTotal,
    IReadOnlyList<WrongByPartItem> WrongByPart,
    int SkippedTotal,
    int VocabDue,
    bool TestedThisWeek,
    Guid? SuggestedTestId,
    string? SuggestedTestTitle
);

/// <param name="Part">Số Part, 1–7.</param>
/// <param name="Count">Số câu sai chưa gỡ thuộc Part đó.</param>
public record WrongByPartItem(int Part, int Count);
