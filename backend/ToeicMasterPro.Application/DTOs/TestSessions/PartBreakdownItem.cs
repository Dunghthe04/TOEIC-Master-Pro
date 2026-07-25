namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Thống kê đúng/sai theo Part (1–7) — Day 30 Phần 2.
/// Chỉ gồm Part có trong phạm vi phiên thi (partial test → ít dòng hơn).
/// </summary>
public record PartBreakdownItem(
    int Part,
    int Correct,
    int Total,
    int Skipped,
    /// <summary>Tỷ lệ đúng = correct / total × 100 (làm tròn 1 chữ số thập phân).</summary>
    double AccuracyPercent
);
