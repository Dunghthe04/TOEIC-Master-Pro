using PDFtoImage;
using SkiaSharp;

namespace EtsImporter;

/// <summary>
/// Render trang PDF thành ảnh PNG.
///
/// ⚠️ VÌ SAO PHẢI RENDER chứ không trích ảnh nhúng: probe cho thấy mỗi trang của bộ ETS này
/// có 4 ảnh cỡ ~2433×1095 — tỉ lệ ngang dẹt. Đó KHÔNG phải 4 ảnh câu hỏi, mà là scan bị
/// cắt thành 4 DẢI NGANG, ghép dọc lại mới thành một trang.
///
/// Nên GetImages() của PdfPig vô dụng ở đây: nó trả về 4 dải rời. Muốn có trang hoàn chỉnh
/// (để AI đọc, và để cắt ảnh Part 1 theo vùng) thì phải để PDFium vẽ cả trang ra bitmap —
/// nó tự ghép các dải, tự áp mọi phép biến hình.
///
/// CACHE THEO FILE: đã có PNG thì bỏ qua. Render 744 trang từ 3 file PDF nặng ~1 GB là việc
/// tốn phút, không được bắt làm lại mỗi lần chạy thử bước sau.
/// </summary>
public static class PdfRenderer
{
    /// <summary>
    /// DPI mặc định 150: đủ nét để AI đọc chữ in nhỏ (đáp án A/B/C/D, chú thích), mà một
    /// trang A4 ra ~1240×1750 — cỡ ảnh mà model vision xử lý tốt. Lên 300 DPI thì ảnh nặng
    /// gấp 4, chậm hơn và tốn token hơn mà chữ đề thi vốn đã đủ to.
    /// </summary>
    public const int DefaultDpi = 150;

    public record Result(int Rendered, int Skipped, List<string> Files);

    /// <summary>
    /// Render các trang trong khoảng [from, to] (1-based, tính cả hai đầu).
    /// to = null → render tới hết file.
    /// </summary>
    public static Result Render(
        string pdfPath, string outDir, int from = 1, int? to = null,
        int dpi = DefaultDpi, bool force = false)
    {
        Directory.CreateDirectory(outDir);

        var bytes = File.ReadAllBytes(pdfPath);
        var pageCount = Conversion.GetPageCount(bytes);

        var last = Math.Min(to ?? pageCount, pageCount);
        from = Math.Max(1, from);

        var stem = Path.GetFileNameWithoutExtension(pdfPath)
            .Replace(" ", "_")
            .Replace(".", "");

        var files = new List<string>();
        int rendered = 0, skipped = 0;

        for (var page = from; page <= last; page++)
        {
            // Số trang pad 4 chữ số để tên file sắp đúng thứ tự khi liệt kê (p0009 < p0010).
            var outPath = Path.Combine(outDir, $"{stem}-p{page:D4}.png");
            files.Add(outPath);

            if (!force && File.Exists(outPath)) { skipped++; continue; }

            // PDFtoImage đánh số trang từ 0, người dùng đếm từ 1.
            using var bitmap = Conversion.ToImage(bytes, page: page - 1, options: new(Dpi: dpi));
            using var data = bitmap.Encode(SKEncodedImageFormat.Png, 90);
            using var fs = File.Create(outPath);
            data.SaveTo(fs);
            rendered++;
        }

        return new Result(rendered, skipped, files);
    }

    public static int GetPageCount(string pdfPath)
        => Conversion.GetPageCount(File.ReadAllBytes(pdfPath));
}
