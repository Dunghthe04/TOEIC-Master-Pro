using ToeicMasterPro.Application.DTOs.TestSessions;

namespace ToeicMasterPro.Application.Common;

/// <summary>
/// Gom thống kê theo Part từ kết quả chấm từng câu — Day 30 Phần 2.
/// </summary>
public static class PartBreakdownBuilder
{
    /// <summary>
    /// Chuyển dictionary đã gom trong SubmitAsync → danh sách PartBreakdownItem (sắp xếp Part 1→7).
    /// </summary>
    public static List<PartBreakdownItem> Build(
        IReadOnlyDictionary<int, (int Correct, int Total, int Skipped)> statsByPart)
    {
        return statsByPart
            .OrderBy(kv => kv.Key)
            .Select(kv => ToItem(kv.Key, kv.Value.Correct, kv.Value.Total, kv.Value.Skipped))
            .ToList();
    }

    internal static PartBreakdownItem ToItem(int part, int correct, int total, int skipped)
    {
        var accuracy = total > 0
            ? Math.Round((double)correct / total * 100, 1)
            : 0;
        return new PartBreakdownItem(part, correct, total, skipped, accuracy);
    }
}
