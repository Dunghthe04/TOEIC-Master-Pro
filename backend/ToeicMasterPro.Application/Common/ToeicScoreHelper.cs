namespace ToeicMasterPro.Application.Common;

/// <summary>
/// Quy đổi số câu đúng → điểm TOEIC (thang 5–495 mỗi section).
///
/// Ghi chú: Bảng quy đổi ETS thật là bảng tra cứu phi tuyến.
/// Day 28 dùng công thức tỷ lệ + làm tròn bội 5 — đủ cho MVP; Day 30 có thể thay bảng ETS.
/// </summary>
public static class ToeicScoreHelper
{
    /// <summary>Số câu chuẩn mỗi section Listening / Reading trong đề TOEIC L&amp;R.</summary>
    public const int ListeningSectionQuestions = 100;
    public const int ReadingSectionQuestions = 100;

    /// <summary>
    /// Quy đổi số câu đúng trong phạm vi Part đã chọn → điểm section.
    ///
    /// Mẫu số cố định <paramref name="fullSectionQuestions"/> (mặc định 100), không dùng chỉ số câu trong phiên —
    /// tránh thi Part 1 (6/6) bị 495 điểm Listening.
    ///
    /// Điểm tối đa khi chỉ làm một phần section = (questionsInScope / fullSectionQuestions) × 495.
    /// questionsInScope = 0 → null.
    /// </summary>
    public static int? ConvertSectionScore(
        int correct,
        int questionsInScope,
        int fullSectionQuestions = 100)
    {
        if (questionsInScope <= 0) return null;
        if (fullSectionQuestions <= 0) fullSectionQuestions = 100;

        var maxForScope = (int)(Math.Round((double)questionsInScope / fullSectionQuestions * 495 / 5) * 5);
        maxForScope = Math.Clamp(maxForScope, 5, 495);

        if (correct <= 0) return Math.Min(5, maxForScope);

        var raw = (double)correct / fullSectionQuestions * 495;
        var rounded = (int)(Math.Round(raw / 5) * 5);
        return Math.Clamp(rounded, 5, maxForScope);
    }
}
