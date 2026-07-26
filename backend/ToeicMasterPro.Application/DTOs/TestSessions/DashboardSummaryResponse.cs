namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/dashboard — dữ liệu tổng hợp trang chủ (Day 32).
///
/// Khác với /stats/by-test (Day 31: best score theo TỪNG ĐỀ),
/// endpoint này gộp MỌI lần thi lại theo thời gian và theo Part.
/// </summary>
public record DashboardSummaryResponse(
    // Mục tiêu user đặt trong profile — vẽ đường ngang trên chart
    int TargetScore,
    // Tổng số lần đã nộp bài (kể cả thi lẻ Part)
    int TotalSessions,
    // Trong đó bao nhiêu lần là full test
    int FullTestSessions,
    int? BestTotalScore,
    int? LatestTotalScore,
    int? AverageTotalScore,
    // Còn thiếu bao nhiêu điểm nữa là đạt mục tiêu (0 = đã đạt), null = chưa có điểm
    int? PointsToTarget,
    // Tỷ lệ đúng gộp tất cả câu đã làm (%)
    double OverallAccuracyPercent,
    int AnsweredQuestions,
    DateTime? LastCompletedAt,
    // Cũ -> mới, để LineChart vẽ đúng chiều thời gian
    IReadOnlyList<DashboardScorePoint> ScoreTrend,
    // Tái dùng PartBreakdownItem của Day 30 — FE đã có sẵn type + helper hiển thị
    IReadOnlyList<PartBreakdownItem> PartAccuracy,
    // Tối đa 3 Part accuracy thấp nhất — FE highlight và gợi ý luyện
    IReadOnlyList<int> WeakParts
)
{
    /// <summary>User chưa thi lần nào — FE hiển thị empty state.</summary>
    public static DashboardSummaryResponse Empty(int targetScore) => new(
        targetScore,
        0, 0,
        null, null, null, null,
        0, 0, null,
        Array.Empty<DashboardScorePoint>(),
        Array.Empty<PartBreakdownItem>(),
        Array.Empty<int>()
    );
}
