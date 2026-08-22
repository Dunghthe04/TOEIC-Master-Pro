using ToeicMasterPro.Application.Common;

namespace EtsImporter;

/// <summary>
/// Đối chiếu thư mục audio với cấu trúc TOEIC chuẩn: đủ chưa, thiếu file nào, có file lạ nào.
///
/// VÌ SAO CẦN: 2000 câu thì không ai soát tay được. Thiếu một file audio nghĩa là một câu
/// không nghe được, và học viên chỉ phát hiện lúc đang thi thật. Kiểm bằng máy là cách duy
/// nhất còn lại.
///
/// ⚠️ Danh sách file MONG ĐỢI được sinh bằng chính ToeicMediaNaming.BuildAudioFileName —
/// hàm mà server dùng khi import. Không tự viết lại quy ước ở đây: viết lại là tạo bản sao
/// thứ hai, và bản sao sẽ lệch vào ngày ai đó sửa một bên. Nếu quy ước đổi, tool tự đổi theo.
/// </summary>
public static class AudioInventory
{
    /// <summary>
    /// Cấu trúc một đề TOEIC Listening. Part 3–4 dùng chung 1 file cho 3 câu nên số FILE
    /// ít hơn số CÂU: 6 + 25 + 13 + 10 = 54 file cho 100 câu.
    /// </summary>
    public static readonly (int Part, int From, int To)[] Structure =
    [
        (1, 1, 6),      // 6 câu, 6 file  — mỗi câu 1 ảnh + 1 audio
        (2, 7, 31),     // 25 câu, 25 file
        (3, 32, 70),    // 39 câu, 13 file (nhóm 3)
        (4, 71, 100),   // 30 câu, 10 file (nhóm 3)
    ];

    /// <summary>
    /// Tên file mong đợi, dựng TRỰC TIẾP từ mã đề/mã test đọc được trong ZIP thay vì từ
    /// chuỗi Series. Dùng khi chỉ cần biết "audio có đủ không", tách khỏi câu hỏi riêng
    /// "Series phải đặt thế nào" (xem ExamCodeDetector).
    /// </summary>
    public static SortedSet<string> ExpectedForCode(string examCode, string testCode)
    {
        var set = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (part, from, to) in Structure)
            for (var order = from; order <= to; order++)
            {
                var (start, end) = ToeicMediaNaming.GetAudioOrderRange(part, order);
                set.Add(start == end
                    ? $"{examCode}-{testCode}-{start}.mp3"
                    : $"{examCode}-{testCode}-{start}-{end}.mp3");
            }

        return set;
    }

    /// <summary>Đối chiếu theo mã đề/mã test đọc được từ ZIP.</summary>
    public static List<TestReport> CompareByCode(
        IEnumerable<string> actualFileNames, string examCode, IEnumerable<string> testCodes)
    {
        var actual = actualFileNames
            .Select(f => ToeicMediaNaming.NormalizeMediaFileName(Path.GetFileName(f)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var reports = new List<TestReport>();
        var claimed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var testCode in testCodes)
        {
            var expected = ExpectedForCode(examCode, testCode);
            var missing = expected.Where(e => !actual.Contains(e)).ToList();
            foreach (var e in expected.Where(actual.Contains)) claimed.Add(e);

            reports.Add(new TestReport(
                testCode, expected.Count, expected.Count - missing.Count, missing, []));
        }

        if (reports.Count > 0)
        {
            var unexpected = actual.Where(a => !claimed.Contains(a)).OrderBy(a => a).ToList();
            reports[0] = reports[0] with { Unexpected = unexpected };
        }

        return reports;
    }

    /// <summary>Tên file audio mong đợi cho một đề, đã dedupe nhóm Part 3–4.</summary>
    public static SortedSet<string> ExpectedFor(string series, string title)
    {
        var set = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (part, from, to) in Structure)
            for (var order = from; order <= to; order++)
                // Part 3–4: BuildAudioFileName trả cùng một tên cho 3 câu liên tiếp,
                // SortedSet tự gộp lại → không cần tính nhóm bằng tay.
                set.Add(ToeicMediaNaming.BuildAudioFileName(series, title, part, order));

        return set;
    }

    public record TestReport(
        string TestTitle,
        int ExpectedCount,
        int FoundCount,
        List<string> Missing,
        List<string> Unexpected
    );

    /// <summary>
    /// So sánh tên file thật với tên mong đợi cho 10 đề.
    ///
    /// Chuẩn hoá tên thật bằng NormalizeMediaFileName trước khi so — đúng cái server làm
    /// khi nhận ZIP, nên "E26-T01-01.mp3" khớp với "E26-T01-1.mp3" mà không phải đổi tên gì.
    /// </summary>
    public static List<TestReport> Compare(
        IEnumerable<string> actualFileNames, string series, int testCount)
    {
        var actual = actualFileNames
            .Select(f => ToeicMediaNaming.NormalizeMediaFileName(Path.GetFileName(f)))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var reports = new List<TestReport>();
        var claimed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        for (var t = 1; t <= testCount; t++)
        {
            var title = $"TEST {t}";
            var expected = ExpectedFor(series, title);

            var missing = expected.Where(e => !actual.Contains(e)).ToList();
            foreach (var e in expected.Where(actual.Contains)) claimed.Add(e);

            reports.Add(new TestReport(
                title, expected.Count, expected.Count - missing.Count, missing, []));
        }

        // File có trong ZIP nhưng không thuộc đề nào — sai tên, sai part, hoặc rác lọt lưới.
        // Gắn vào report đầu tiên vì nó là vấn đề của cả bộ, không của riêng đề nào.
        if (reports.Count > 0)
        {
            var unexpected = actual.Where(a => !claimed.Contains(a)).OrderBy(a => a).ToList();
            reports[0] = reports[0] with { Unexpected = unexpected };
        }

        return reports;
    }
}
