namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/stats/timeline — điểm theo thời gian (Day 32 Bước 2).
/// Items sắp xếp cũ → mới để vẽ line chart trái sang phải.
/// </summary>
public record TestStatsTimelineResponse(
    int TargetScore,
    IReadOnlyList<TestStatsTimelineItem> Items
);
