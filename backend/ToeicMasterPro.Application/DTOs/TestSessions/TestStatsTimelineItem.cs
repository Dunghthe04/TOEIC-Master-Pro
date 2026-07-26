namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Một điểm trên biểu đồ timeline — 1 phiên thi đã nộp (Day 32 Bước 2).
/// </summary>
public record TestStatsTimelineItem(
    Guid SessionId,
    Guid TestId,
    string TestTitle,
    string TestSeries,
    DateTime CompletedAt,
    /// <summary>Part đã chọn — null = full test.</summary>
    int[]? PartsFilter,
    int? ListeningScore,
    int? ReadingScore,
    int? TotalScore
);
