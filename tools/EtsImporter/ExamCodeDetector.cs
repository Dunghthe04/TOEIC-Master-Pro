using System.Text.RegularExpressions;
using ToeicMasterPro.Application.Common;

namespace EtsImporter;

/// <summary>
/// Đọc mã đề (E26) và danh sách mã test (T01..T10) TỪ CHÍNH TÊN FILE AUDIO, rồi kiểm xem
/// giá trị Series sắp đặt cho Test có sinh ra đúng mã đó không.
///
/// ⚠️ VÌ SAO CẦN CẢ MỘT FILE CHO VIỆC NÀY — bẫy đã va khi viết tool:
/// ToExamCode("ETS 2026") KHÔNG trả "E26" mà trả "ETS2026", vì sau khi bỏ dấu cách thì
/// "ETS2026" khớp ngay nhánh regex đầu tiên (^[A-Za-z]{1,6}\d{1,4}$) và nhánh rút gọn năm
/// không bao giờ chạy.
///
/// Hậu quả nếu không phát hiện: đặt Series = "ETS 2026" thì server tự sinh tên
/// "ETS2026-T01-1.mp3" trong khi file thật tên "E26-T01-1.mp3" → MỌI câu Listening mất
/// audio. Và nó IM LẶNG: import vẫn thành công, chỉ là đến lúc thi mới thấy không có tiếng.
///
/// Nên thay vì bắt người dùng đoán, đọc mã từ file thật rồi nói luôn phải đặt Series là gì.
/// </summary>
public static class ExamCodeDetector
{
    /// <summary>E26-T01-1.mp3 / E26-T01-32-34.mp3 → ("E26", "T01").</summary>
    private static readonly Regex Pattern =
        new(@"^(?<exam>[A-Za-z0-9]+)-(?<test>T\d{1,3})-\d", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public record Detection(
        string? ExamCode,
        List<string> TestCodes,
        Dictionary<string, int> ExamCodeCounts,
        int Unparseable
    );

    public static Detection Detect(IEnumerable<string> audioFileNames)
    {
        var examCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var tests = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
        var bad = 0;

        foreach (var raw in audioFileNames)
        {
            var name = Path.GetFileNameWithoutExtension(raw);
            var m = Pattern.Match(name);
            if (!m.Success) { bad++; continue; }

            var exam = m.Groups["exam"].Value.ToUpperInvariant();
            examCounts[exam] = examCounts.GetValueOrDefault(exam) + 1;
            tests.Add(m.Groups["test"].Value.ToUpperInvariant());
        }

        // Mã đề = cái xuất hiện nhiều nhất. Nhiều mã khác nhau trong một ZIP là dấu hiệu
        // trộn hai bộ sách, và probe phải báo ra chứ không chọn im lặng.
        var dominant = examCounts.Count == 0
            ? null
            : examCounts.OrderByDescending(kv => kv.Value).First().Key;

        return new Detection(dominant, tests.ToList(), examCounts, bad);
    }

    /// <summary>
    /// Tìm giá trị Series nên đặt cho Test để ToExamCode() sinh ra đúng examCode mong muốn.
    ///
    /// Thử các dạng thường dùng thay vì suy luận ngược regex: ít code, và tự đúng nếu sau
    /// này ToExamCode đổi cách hoạt động (vì nó GỌI hàm thật để kiểm, không mô phỏng).
    /// </summary>
    public static List<string> SuggestSeriesValues(string examCode)
    {
        var year = Regex.Match(examCode, @"^E(\d{2})$");
        var candidates = new List<string> { examCode };

        if (year.Success)
        {
            var yy = year.Groups[1].Value;
            candidates.Add($"ETS-20{yy}");
            candidates.Add($"ETS_20{yy}");
            candidates.Add($"ETS 20{yy}");   // đưa vào để CHỨNG MINH nó sai, không phải để dùng
        }

        return candidates
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(c => ToeicMediaNaming.ToExamCode(c)
                            .Equals(examCode, StringComparison.OrdinalIgnoreCase))
            .ToList();
    }
}
