namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Một lần thi đã nộp — dùng cho danh sách lịch sử (Day 31).
/// Cùng đề thi nhiều lần → nhiều dòng (không ghi đè).
/// </summary>
public record TestSessionHistoryItem(
    Guid SessionId,
    Guid TestId,
    string TestTitle,
    string TestSeries,
    DateTime StartedAt,
    DateTime CompletedAt,
    /// <summary>Part đã chọn — null = full test.</summary>
    int[]? PartsFilter,
    int? ListeningScore,
    int? ReadingScore,
    int? TotalScore,
    int CorrectCount,
    int TotalCount
);
