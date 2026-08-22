using System.IO.Compression;
using EtsImporter;
using ToeicMasterPro.Application.Common;

// ────────────────────────────────────────────────────────────────────────────
// EtsImporter — tool nhập đề ETS từ ZIP (PDF + audio) thành file import.
//
// Chạy:  dotnet run --project tools/EtsImporter -- probe <đường-dẫn-zip>
//
// Lệnh hiện có:
//   probe   Đọc ZIP và BÁO CÁO nội dung. Chưa trích xuất gì.
//           Trả lời 3 câu quyết định cách viết các bước sau:
//             1. PDF là chữ thật hay scan?           → parse trực tiếp hay phải OCR
//             2. Ảnh Part 1 là object nhúng?          → lấy ra được hay phải cắt theo vùng
//             3. Audio đủ 54 file × 10 đề chưa?       → thiếu câu nào
//
// Vì sao probe là lệnh đầu tiên: cách viết phần trích xuất phụ thuộc hoàn toàn vào loại
// PDF, và hai cách (chữ thật / scan) không dùng lại được gì của nhau. Đo trước, viết sau.
// ────────────────────────────────────────────────────────────────────────────

if (args.Length == 0 || args[0] is "-h" or "--help")
{
    Console.WriteLine("""
        EtsImporter — nhập đề ETS từ ZIP

          probe <zip>    Báo cáo nội dung ZIP: loại PDF, ảnh nhúng, kiểm kê audio
        """);
    return 0;
}

switch (args[0])
{
    case "probe":
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Thiếu đường dẫn ZIP. Ví dụ: probe \"D:\\ETS2026.zip\"");
            return 1;
        }
        return Probe(args[1]);

    default:
        Console.Error.WriteLine($"Lệnh không biết: {args[0]}");
        return 1;
}

static int Probe(string zipPath)
{
    if (!File.Exists(zipPath))
    {
        Console.Error.WriteLine($"Không thấy file: {zipPath}");
        return 1;
    }

    Console.WriteLine($"ZIP: {zipPath}");
    Console.WriteLine($"Kích thước: {new FileInfo(zipPath).Length / 1024.0 / 1024.0:F1} MB");
    Console.WriteLine();

    var contents = ZipInspector.Inspect(zipPath);

    // ── Tổng quan ──
    Console.WriteLine("── NỘI DUNG ─────────────────────────────────────────────");
    Console.WriteLine($"  audio  : {contents.Audio.Count,5}");
    Console.WriteLine($"  pdf    : {contents.Pdfs.Count,5}");
    Console.WriteLine($"  ảnh    : {contents.Images.Count,5}");
    Console.WriteLine($"  khác   : {contents.Others.Count,5}");
    Console.WriteLine($"  zip lồng: {contents.NestedZips.Count,4}");

    // Báo rác chứ không im lặng bỏ qua: người dùng cần biết ZIP có 540 file rác, vì nếu
    // không lọc thì số audio nhìn vào GẤP ĐÔI thực tế → tưởng đủ trong khi đang thiếu.
    if (contents.Junk.Count > 0)
    {
        var junkBytes = contents.Junk.Sum(j => j.Length);
        Console.WriteLine($"  ĐÃ LỌC RÁC: {contents.Junk.Count} file ({junkBytes / 1024.0:F0} KB) " +
                          "— macOS AppleDouble (._*), __MACOSX/, .DS_Store");
        Console.WriteLine($"             ví dụ: {contents.Junk[0].Name} ({contents.Junk[0].Length} bytes)");
    }
    Console.WriteLine();

    if (contents.NestedZips.Count > 0)
    {
        Console.WriteLine("⚠️  Có ZIP lồng trong ZIP — phải giải nén thêm một lớp:");
        foreach (var z in contents.NestedZips)
            Console.WriteLine($"     {z.Path} ({z.Length / 1024.0 / 1024.0:F1} MB)");
        Console.WriteLine();
    }

    // ── Kiểm kê audio ──
    if (contents.Audio.Count > 0)
    {
        var det = ExamCodeDetector.Detect(contents.Audio.Select(a => a.Name));

        Console.WriteLine("── MÃ ĐỀ đọc được từ tên file audio ────────────────────");
        if (det.ExamCode is null)
        {
            Console.WriteLine("   ✗ Không đọc được mã đề nào. Tên file không theo dạng <MÃ>-T<nn>-<số>.");
            Console.WriteLine("     Không kiểm kê được audio — bỏ qua phần này.");
            Console.WriteLine();
        }
        else
        {
            Console.WriteLine($"   mã đề : {det.ExamCode}");
            Console.WriteLine($"   số đề : {det.TestCodes.Count} ({string.Join(", ", det.TestCodes)})");
            if (det.ExamCodeCounts.Count > 1)
                Console.WriteLine($"   ⚠️  Có {det.ExamCodeCounts.Count} mã đề khác nhau trong 1 ZIP " +
                                  $"({string.Join(", ", det.ExamCodeCounts.Select(kv => $"{kv.Key}={kv.Value}"))}) " +
                                  "— nghi trộn 2 bộ sách.");
            if (det.Unparseable > 0)
                Console.WriteLine($"   ⚠️  {det.Unparseable} file không đọc được mã (sai quy ước tên).");
            Console.WriteLine();

            // 🔴 Điểm dễ sai nhất của cả luồng import, xem ExamCodeDetector để biết vì sao.
            var suggestions = ExamCodeDetector.SuggestSeriesValues(det.ExamCode);
            Console.WriteLine("   🔴 QUAN TRỌNG — giá trị Series phải đặt cho Test:");
            if (suggestions.Count > 0)
                Console.WriteLine($"      Series = \"{suggestions[0]}\"" +
                                  (suggestions.Count > 1
                                      ? $"   (hoặc: {string.Join(", ", suggestions.Skip(1).Select(s => $"\"{s}\""))})"
                                      : ""));
            else
                Console.WriteLine($"      Không tìm được chuỗi nào cho ToExamCode() ra \"{det.ExamCode}\" — " +
                                  "phải đặt Series đúng bằng mã đề.");

            var wrong = ToeicMediaNaming.ToExamCode("ETS 2026");
            if (!wrong.Equals(det.ExamCode, StringComparison.OrdinalIgnoreCase))
                Console.WriteLine($"      ✗ ĐỪNG đặt \"ETS 2026\" — nó sinh ra \"{wrong}\", " +
                                  $"lệch với file thật \"{det.ExamCode}\" → MỌI câu mất audio, và KHÔNG có lỗi nào báo.");
            Console.WriteLine();
        }

        Console.WriteLine("── AUDIO: đối chiếu cấu trúc TOEIC ──────────────────────");
        Console.WriteLine("   (mong đợi 54 file/đề: P1 6 + P2 25 + P3 13 nhóm + P4 10 nhóm)");
        Console.WriteLine();

        var reports = det.ExamCode is null
            ? []
            : AudioInventory.CompareByCode(
                contents.Audio.Select(a => a.Name), det.ExamCode, det.TestCodes);

        foreach (var r in reports)
        {
            var ok = r.Missing.Count == 0 ? "✓" : "✗";
            Console.WriteLine($"   {ok} {r.TestTitle,-8} {r.FoundCount,3}/{r.ExpectedCount}");

            if (r.Missing.Count > 0)
            {
                // In tối đa 8 tên: thiếu cả 54 file thì in hết chỉ làm rối, con số đã đủ nói.
                var show = string.Join(", ", r.Missing.Take(8));
                var more = r.Missing.Count > 8 ? $" … (+{r.Missing.Count - 8})" : "";
                Console.WriteLine($"       thiếu: {show}{more}");
            }
        }

        var unexpected = reports.FirstOrDefault()?.Unexpected ?? [];
        if (unexpected.Count > 0)
        {
            Console.WriteLine();
            Console.WriteLine($"   ⚠️  {unexpected.Count} file KHÔNG thuộc đề nào (sai tên / sai part / rác lọt lưới):");
            foreach (var u in unexpected.Take(10)) Console.WriteLine($"       {u}");
            if (unexpected.Count > 10) Console.WriteLine($"       … (+{unexpected.Count - 10})");
        }
        Console.WriteLine();
    }

    // ── Soi từng PDF ──
    if (contents.Pdfs.Count == 0)
    {
        Console.WriteLine("Không có PDF nào trong ZIP — không đọc được đề.");
        return 0;
    }

    Console.WriteLine("── PDF: loại nào, ảnh nhúng ra sao ─────────────────────");
    using var zip = ZipFile.OpenRead(zipPath);

    foreach (var pdf in contents.Pdfs)
    {
        Console.WriteLine();
        Console.WriteLine($"  ▸ {pdf.Path}");
        Console.WriteLine($"    {pdf.Length / 1024.0 / 1024.0:F1} MB · đoán vai trò: {ZipInspector.GuessPdfRole(pdf.Name)}");

        var entry = zip.GetEntry(pdf.Path) ?? zip.Entries.FirstOrDefault(e => e.Name == pdf.Name);
        if (entry is null) { Console.WriteLine("    (không mở được entry)"); continue; }

        // PdfPig cần stream seek được, mà stream của ZipArchive thì không → copy ra memory.
        using var ms = new MemoryStream();
        using (var es = entry.Open()) es.CopyTo(ms);
        ms.Position = 0;

        try
        {
            var rep = PdfProbe.Probe(pdf.Name, ms);
            Console.WriteLine($"    {rep.PageCount} trang");
            Console.WriteLine($"    ➜ {rep.Verdict}");
            Console.WriteLine();
            Console.WriteLine("      trang | ký tự | ảnh | ảnh lớn nhất");
            foreach (var p in rep.Pages)
                Console.WriteLine($"      {p.Number,5} | {p.TextChars,5} | {p.ImageCount,3} | {p.LargestImage}");

            if (rep.FirstTextSample.Length > 0)
            {
                Console.WriteLine();
                Console.WriteLine($"      chữ đọc được: \"{rep.FirstTextSample}\"");
            }
        }
        catch (Exception ex)
        {
            // PDF mã hoá / hỏng / dùng filter lạ — báo rõ chứ không làm sập cả lệnh probe,
            // vì các PDF còn lại vẫn cần được soi.
            Console.WriteLine($"    ✗ Không đọc được: {ex.GetType().Name} — {ex.Message}");
        }
    }

    Console.WriteLine();
    Console.WriteLine("── ĐỌC KẾT QUẢ ─────────────────────────────────────────");
    Console.WriteLine("""
      · "CHỮ THẬT"  → parse text trực tiếp; ảnh Part 1 lấy bằng GetImages() nếu cột "ảnh"
                      của trang Part 1 là 1-2 ảnh nhỏ (chính là 1 ảnh/câu)
      · "SCAN"      → phải OCR để có text, và ảnh Part 1 phải CẮT THEO VÙNG toạ độ
      · Cột "ảnh" = 1 và ảnh lớn nhất bằng cỡ trang (vd 1653x2339) → cả trang là 1 ảnh scan
      · Cột "ảnh" = 6 ở trang Part 1 → 6 ảnh nhúng riêng, lấy ra trực tiếp được
      """);

    return 0;
}
