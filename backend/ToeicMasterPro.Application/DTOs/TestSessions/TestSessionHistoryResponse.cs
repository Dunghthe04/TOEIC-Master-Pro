namespace ToeicMasterPro.Application.DTOs.TestSessions;

/// <summary>
/// Response GET /api/test-session/history — phân trang danh sách lần thi đã nộp.
/// </summary>
public record TestSessionHistoryResponse(
    IReadOnlyList<TestSessionHistoryItem> Items,
    int Total,
    int Page,
    int PageSize
);
