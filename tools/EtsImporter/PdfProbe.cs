using UglyToad.PdfPig;

namespace EtsImporter;

/// <summary>
/// Đọc PDF ở mức "nó thuộc loại gì", chưa trích xuất nội dung.
///
/// VÌ SAO ĐÂY LÀ BƯỚC ĐẦU TIÊN: cách viết phần trích xuất phụ thuộc HOÀN TOÀN vào loại PDF,
/// và hai cách không dùng lại được gì của nhau:
///
///   PDF chữ thật + ảnh nhúng  →  lấy text bằng parser, lấy ảnh Part 1 bằng GetImages()
///                                (đúng biên, không cần dò), đoạn văn Part 6-7 parse theo
///                                mốc "Questions 131-134 refer to the following..."
///   PDF scan (1 ảnh/trang)    →  phải OCR để có text, và ảnh Part 1 phải CẮT THEO VÙNG
///                                toạ độ — tức phải dò biên, và mỗi bộ sách một layout
///
/// Đoán sai loại là viết lại từ đầu. Nên đo trước, viết sau.
/// </summary>
public static class PdfProbe
{
    public record PageInfo(int Number, int TextChars, int ImageCount, string LargestImage);

    public record PdfReport(
        string FileName,
        int PageCount,
        List<PageInfo> Pages,
        string Verdict,
        string FirstTextSample
    );

    public static PdfReport Probe(string fileName, Stream stream, int maxPagesToScan = 12)
    {
        using var doc = PdfDocument.Open(stream);

        var pages = new List<PageInfo>();
        var sample = "";
        var scan = Math.Min(maxPagesToScan, doc.NumberOfPages);

        for (var i = 1; i <= scan; i++)
        {
            var page = doc.GetPage(i);
            var text = page.Text ?? "";

            var images = page.GetImages().ToList();
            var largest = "—";
            if (images.Count > 0)
            {
                var big = images.OrderByDescending(im => im.WidthInSamples * (long)im.HeightInSamples).First();
                largest = $"{big.WidthInSamples}x{big.HeightInSamples}";
            }

            pages.Add(new PageInfo(i, text.Length, images.Count, largest));

            if (sample.Length == 0 && text.Trim().Length > 40)
                sample = text.Trim().Replace('\n', ' ').Replace('\r', ' ');
        }

        return new PdfReport(
            fileName,
            doc.NumberOfPages,
            pages,
            Verdict(pages),
            sample.Length > 220 ? sample[..220] + "…" : sample);
    }

    /// <summary>
    /// Kết luận loại PDF từ số liệu đo được.
    ///
    /// Ngưỡng 200 ký tự/trang: một trang đề TOEIC có chữ thật luôn vượt xa mức đó (riêng
    /// Part 5 đã ~1500 ký tự). Trang scan thường trả 0, hoặc vài chục ký tự nếu PDF có lớp
    /// OCR sẵn — trường hợp đó vẫn dùng được text nhưng phải soát vì OCR có lỗi.
    ///
    /// "1 ảnh lớn/trang và không có chữ" là dấu hiệu kinh điển của scan.
    /// </summary>
    private static string Verdict(List<PageInfo> pages)
    {
        if (pages.Count == 0) return "PDF rỗng";

        var avgChars = pages.Average(p => p.TextChars);
        var pagesWithText = pages.Count(p => p.TextChars > 200);
        var pagesOneBigImage = pages.Count(p => p.ImageCount == 1 && p.TextChars < 50);

        if (pagesOneBigImage >= pages.Count * 0.7)
            return "SCAN (mỗi trang 1 ảnh lớn, không có chữ) → cần OCR + cắt ảnh theo vùng";

        if (pagesWithText >= pages.Count * 0.7)
            return $"CHỮ THẬT (trung bình {avgChars:F0} ký tự/trang) → parse trực tiếp được";

        if (avgChars > 50)
            return $"HỖN HỢP hoặc có lớp OCR ({avgChars:F0} ký tự/trang) → dùng được nhưng PHẢI soát";

        return "KHÔNG LẤY ĐƯỢC CHỮ → gần như chắc là scan";
    }
}
