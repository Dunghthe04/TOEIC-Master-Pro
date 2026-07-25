namespace ToeicMasterPro.Application.Common;

/// <summary>
/// Bảng quy đổi số câu đúng (raw 0–100) → điểm scaled 5–495 theo section.
///
/// Nguồn tham chiếu: bảng WIE TOEIC Conversion (ước lượng industry-standard;
/// ETS không công bố bảng chính thức — mỗi form đề có equating riêng).
/// Day 30 Bước 1a — dữ liệu; Bước 1b dùng qua <see cref="ToeicScoreHelper"/> (full section 100 câu).
///
/// Index = số câu đúng trong section (0–100).
/// </summary>
public static class ToeicEtsConversionTable
{
    /// <summary>Listening — điểm scaled theo số câu đúng / 100.</summary>
    public static readonly int[] ListeningByCorrectCount =
    [
        // 0–17 câu
        5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
        // 18–39
        10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 85, 90, 95, 100, 105, 115, 125, 135, 140,
        // 40–59
        150, 160, 170, 175, 180, 190, 200, 205, 215, 220, 225, 230, 235, 245, 255, 260, 265, 275, 285, 290,
        // 60–79
        295, 300, 310, 320, 325, 330, 335, 340, 345, 350, 355, 360, 365, 370, 375, 385, 395, 400, 405, 415,
        // 80–99
        420, 425, 430, 435, 440, 445, 455, 460, 465, 475, 480, 485, 490, 495, 495, 495, 495, 495, 495, 495,
        // 100
        495,
    ];

    /// <summary>Reading — điểm scaled theo số câu đúng / 100 (khác Listening cùng raw).</summary>
    public static readonly int[] ReadingByCorrectCount =
    [
        // 0–17 câu
        5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
        // 18–39
        5, 5, 5, 5, 10, 15, 20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90, 95, 105,
        // 40–59
        115, 120, 125, 130, 135, 140, 145, 155, 160, 170, 175, 185, 195, 205, 210, 215, 220, 230, 240, 245,
        // 60–79
        250, 255, 260, 270, 275, 280, 285, 290, 295, 295, 300, 310, 315, 320, 325, 330, 335, 340, 345, 355,
        // 80–99
        360, 370, 375, 385, 390, 395, 405, 415, 420, 425, 435, 440, 450, 455, 460, 470, 475, 485, 485, 490,
        // 100
        495,
    ];

    /// <summary>Số phần tử chuẩn mỗi section (0..100 câu đúng).</summary>
    public const int TableLength = 101;

    /// <summary>Tra điểm Listening — clamp 0..100.</summary>
    public static int LookupListening(int correctCount)
    {
        var index = Math.Clamp(correctCount, 0, 100);
        return ListeningByCorrectCount[index];
    }

    /// <summary>Tra điểm Reading — clamp 0..100.</summary>
    public static int LookupReading(int correctCount)
    {
        var index = Math.Clamp(correctCount, 0, 100);
        return ReadingByCorrectCount[index];
    }
}
