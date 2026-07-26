namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/stats/parts — gom % đúng Part 1–7 từ nhiều phiên (Day 32 Bước 3).
/// partBreakdown không lưu DB — tính lại từ TestSessionAnswers + Question.Part.
/// </summary>
public record TestStatsPartsResponse(
    /// <summary>Số phiên đã nộp dùng để gom (theo fullOnly).</summary>
    int SessionsAnalyzed,
    /// <summary>Thống kê gom theo Part — chỉ Part có ít nhất 1 câu.</summary>
    IReadOnlyList<PartBreakdownItem> Parts,
    /// <summary>Part accuracy thấp nhất — có thể nhiều Part nếu hòa.</summary>
    IReadOnlyList<int> WeakestParts
);
