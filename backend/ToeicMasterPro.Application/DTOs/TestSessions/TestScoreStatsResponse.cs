namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/stats/by-test — biểu đồ cột best score / đề.
/// </summary>
public record TestScoreStatsResponse(
    /// <summary>Mục tiêu user — vẽ đường ngang trên chart.</summary>
    int TargetScore,
    IReadOnlyList<TestScoreByTestItem> Items
);
