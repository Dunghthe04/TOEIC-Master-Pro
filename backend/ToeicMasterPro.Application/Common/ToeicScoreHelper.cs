namespace ToeicMasterPro.Application.Common;

/// <summary>
/// Quy đổi số câu đúng → điểm TOEIC (thang 5–495 mỗi section).
///
/// Ghi chú: Bảng quy đổi ETS thật là bảng tra cứu phi tuyến.
/// Day 28 dùng công thức tỷ lệ + làm tròn bội 5 — đủ cho MVP; Day 30 có thể thay bảng ETS.
/// </summary>
public static class ToeicScoreHelper
{
    /// <summary>
    /// correct/total → điểm 5–495 (làm tròn bội 5).
    /// total = 0 → null (section không có câu).
    /// </summary>
    public static int? ConvertSectionScore(int correct, int total)
    {
        if (total <= 0) return null;
        var ratio = (double)correct / total * 495;
        var rounded = (int)(Math.Round(ratio / 5) * 5);
        return Math.Clamp(rounded, 5, 495);
    }
}
