using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Chi tiết 1 phiên thi đã nộp — GET /api/test-session/{id} (Day 31 Bước 2).
/// Dùng xem lại kết quả / review từ lịch sử (không gọi submit lại).
/// </summary>
public record TestSessionDetailResponse(
    Guid SessionId,
    Guid TestId,
    string TestTitle,
    string TestSeries,
    TestSessionStatus Status,
    DateTime StartedAt,
    DateTime CompletedAt,
    int[]? PartsFilter,
    int CorrectCount,
    int TotalCount,
    int SkippedCount,
    int? ListeningScore,
    int? ReadingScore,
    int? TotalScore,
    List<PartBreakdownItem> PartBreakdown,
    List<SessionAnswerReview> Reviews
);
