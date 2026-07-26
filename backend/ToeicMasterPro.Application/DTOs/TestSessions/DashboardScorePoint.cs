namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Một điểm trên biểu đồ đường "xu hướng điểm" (Day 32).
/// Mỗi lần thi đã nộp và có điểm = 1 điểm trên trục thời gian.
/// </summary>
public record DashboardScorePoint(
    Guid SessionId,
    Guid TestId,
    string TestTitle,
    DateTime CompletedAt,
    // true = thi full đề (PartsFilter rỗng); false = chỉ thi vài Part
    bool IsFullTest,
    int? ListeningScore,
    int? ReadingScore,
    int? TotalScore
);
