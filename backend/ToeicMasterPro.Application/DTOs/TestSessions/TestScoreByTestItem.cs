namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Điểm best theo từng đề — 1 cột trên biểu đồ dashboard (Day 31 Bước 3).
/// </summary>
public record TestScoreByTestItem(
    Guid TestId,
    string TestTitle,
    string TestSeries,
    /// <summary>Số lần đã nộp (trong phạm vi filter full/partial).</summary>
    int AttemptCount,
    int? BestTotalScore,
    int? BestListeningScore,
    int? BestReadingScore,
    /// <summary>Session đạt best — mở GET /test-session/{id}.</summary>
    Guid? BestSessionId,
    DateTime? LastCompletedAt
);
