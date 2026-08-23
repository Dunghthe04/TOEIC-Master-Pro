namespace ToeicMasterPro.Application.DTOs.Tests;

/// <summary>
/// Nội dung file <c>manifest.json</c> trong gói ZIP import đề.
///
/// MỤC ĐÍCH: gói ZIP tự khai nó là đề nào và chứa phần nào, để server đối chiếu TRƯỚC KHI
/// ghi DB.
///
/// 🔴 LỖI MÀ NÓ CHẶN: hiện tại không có gì ngăn việc chọn nhầm gói. Upload Test1.zip vào
/// đề Test 3 thì import chạy trơn, báo "100 câu thành công", và đề Test 3 bị thay bằng nội
/// dung của Test 1. Không có lỗi nào cho biết — vì đứng ở góc độ dữ liệu thì mọi thứ hợp lệ.
/// Có manifest thì server so <c>title</c> trong gói với đề đang nhập và từ chối ngay.
///
/// Manifest là TÙY CHỌN: gói không có nó vẫn import được như trước (coi như chỉ có
/// Listening). Làm vậy để các gói cũ và UI hiện tại không vỡ.
/// </summary>
/// <param name="Series">
/// Mã bộ đề, ví dụ "E26". Server so với <c>Test.Series</c> sau khi cùng chuẩn hoá qua
/// ToExamCode — nhờ đó bắt được đúng cái bẫy "ETS 2026" sinh ra "ETS2026" thay vì "E26".
/// </param>
/// <param name="Title">
/// Tên đề, ví dụ "Test1". So sau khi chuẩn hoá qua ToTestCode nên "Test 1" và "Test1" đều
/// khớp, nhưng "Test 3" thì không.
/// </param>
/// <param name="Sections">
/// Phần có trong gói: "listening", "reading", hoặc cả hai. Cho phép gói KHÔNG ĐẦY ĐỦ —
/// sửa vài câu Reading thì gửi gói chỉ có reading, khỏi upload lại 40 MB audio.
/// </param>
/// <param name="Source">Nguồn đề, chỉ để ghi log và truy vết. Ví dụ "ETS 2026 · tool v1".</param>
public record ImportManifest(
    string? Series,
    string? Title,
    List<string>? Sections,
    string? Source
);
