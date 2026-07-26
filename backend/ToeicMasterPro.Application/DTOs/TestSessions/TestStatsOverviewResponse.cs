namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/stats/overview — tổng quan dashboard (Day 32 Bước 1).
/// Dùng cho các card: số lần thi, điểm cao nhất / gần nhất / trung bình, mục tiêu.
/// </summary>
public record TestStatsOverviewResponse(
    /// <summary>Mục tiêu TOEIC user đặt trong profile.</summary>
    int TargetScore,
    /// <summary>Tổng số phiên đã nộp (theo bộ lọc fullOnly).</summary>
    int TotalAttempts,
    /// <summary>Số đề khác nhau user đã thi (trong tập phiên đã lọc).</summary>
    int DistinctTests,
    /// <summary>Điểm Total cao nhất; null nếu chưa có phiên có điểm.</summary>
    int? BestTotalScore,
    /// <summary>Id phiên đạt best — FE link sang xem lại kết quả.</summary>
    Guid? BestSessionId,
    /// <summary>Điểm Total lần thi gần nhất.</summary>
    int? LatestTotalScore,
    /// <summary>Id phiên gần nhất.</summary>
    Guid? LatestSessionId,
    /// <summary>Trung bình TotalScore; null nếu chưa có điểm.</summary>
    double? AverageTotalScore,
    /// <summary>Thời điểm nộp bài gần nhất.</summary>
    DateTime? LastCompletedAt
);
