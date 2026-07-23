using System.Text.RegularExpressions;



namespace ToeicMasterPro.Application.Common;



/// <summary>

/// Quy ước đặt tên file media Listening: {MãĐề}-{MãTest}-{SốCâu}

/// Ví dụ: E26-T01-1.mp3 = câu 1, TEST 1, ETS 2026.

/// Part 3–4: khoảng 3 câu — E26-T01-38-40.mp3 cho câu 38–40.

/// </summary>

public static class ToeicMediaNaming

{

    /// <summary>ETS 2026 → E26; đã là E26 thì giữ nguyên.</summary>

    public static string ToExamCode(string series)

    {

        if (string.IsNullOrWhiteSpace(series)) return "EXAM";

        var s = series.Trim().Replace(" ", "");



        if (Regex.IsMatch(s, @"^[A-Za-z]{1,6}\d{1,4}$", RegexOptions.IgnoreCase))

            return s.ToUpperInvariant();



        var year = Regex.Match(series, @"20(\d{2})");

        if (year.Success) return $"E{year.Groups[1].Value}";



        var letters = new string(series.Where(char.IsLetter).Take(3).ToArray()).ToUpperInvariant();

        return string.IsNullOrEmpty(letters) ? "EXAM" : letters;

    }



    /// <summary>TEST 1 → T01; Test1-ETS → T01.</summary>

    public static string ToTestCode(string title)

    {

        if (string.IsNullOrWhiteSpace(title)) return "T01";

        var num = Regex.Match(title, @"(\d+)");

        return num.Success ? $"T{num.Groups[1].Value.PadLeft(2, '0')}" : "T01";

    }



    /// <summary>Khoảng số câu trong tên file (Part 3–4 = 3 câu / nhóm).</summary>

    public static (int Start, int End) GetAudioOrderRange(int part, int orderIndex)

    {

        return part switch

        {

            3 when orderIndex >= 32 =>

                (32 + ((orderIndex - 32) / 3) * 3, 32 + ((orderIndex - 32) / 3) * 3 + 2),

            4 when orderIndex >= 71 =>

                (71 + ((orderIndex - 71) / 3) * 3, 71 + ((orderIndex - 71) / 3) * 3 + 2),

            _ => (orderIndex, orderIndex)

        };

    }



    /// <summary>Tên file audio mặc định (không gồm thư mục).</summary>

    public static string BuildAudioFileName(string series, string title, int part, int orderIndex)

    {

        var exam = ToExamCode(series);

        var test = ToTestCode(title);

        var (start, end) = GetAudioOrderRange(part, orderIndex);

        return start == end

            ? $"{exam}-{test}-{start}.mp3"

            : $"{exam}-{test}-{start}-{end}.mp3";

    }



    /// <summary>Tên file ảnh Part 1 — 1 câu / 1 ảnh.</summary>

    public static string BuildImageFileName(string series, string title, int orderIndex)

        => BuildAudioFileName(series, title, 1, orderIndex).Replace(".mp3", ".jpg", StringComparison.OrdinalIgnoreCase);

    /// <summary>E26-T01-07.mp3 → E26-T01-7.mp3; giữ E26-T01-38-40.mp3.</summary>
    public static string NormalizeMediaFileName(string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return fileName;
        var name = Path.GetFileName(fileName.Trim());
        var ext = Path.GetExtension(name);
        var stem = Path.GetFileNameWithoutExtension(name);

        var range = Regex.Match(stem, @"^(.+)-(\d+)-(\d+)$");
        if (range.Success)
        {
            var a = int.Parse(range.Groups[2].Value);
            var b = int.Parse(range.Groups[3].Value);
            return $"{range.Groups[1].Value}-{a}-{b}{ext}";
        }

        var single = Regex.Match(stem, @"^(.+)-(\d+)$");
        if (single.Success)
            return $"{single.Groups[1].Value}-{int.Parse(single.Groups[2].Value)}{ext}";

        return name;
    }

}

