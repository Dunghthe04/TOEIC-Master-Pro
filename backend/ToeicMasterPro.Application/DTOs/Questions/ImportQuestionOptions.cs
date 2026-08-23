namespace ToeicMasterPro.Application.DTOs.Questions;

/// <summary>Tùy chọn import — gắn media theo đề, tự sinh AudioFile (E26-T01-1 / E26-T01-38-40).</summary>
public record ImportQuestionOptions(
    Guid? TestId = null,
    /// <summary>Tự gán câu vừa import vào đề (cần TestId).</summary>
    bool AssignToTest = false,
    /// <summary>
    /// Chỉ ĐỌC và KIỂM, không ghi gì vào DB.
    ///
    /// MỤC ĐÍCH: import 200 câu là việc khó hoàn tác. Sai một cột trong Excel, chọn nhầm gói,
    /// thiếu file audio — hiện tại chỉ phát hiện được SAU KHI đã ghi vào đề, rồi phải dọn tay.
    /// Chế độ này chạy hết mọi bước kiểm, báo cáo đầy đủ, rồi dừng.
    ///
    /// Kết quả trả về vẫn có danh sách <c>Created</c>, nhưng QuestionId là Guid.Empty — đó là
    /// danh sách "SẼ tạo", không phải "đã tạo". Bên gọi PHẢI không được gán vào đề khi cờ này
    /// bật.
    /// </summary>
    bool DryRun = false
);
