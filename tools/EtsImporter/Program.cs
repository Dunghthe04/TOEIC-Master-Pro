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
            Console.Error.WriteLine("Thiếu đường dẫn. Ví dụ: probe \"D:\\ETS2026.zip\"  (hoặc một thư mục)");
            return 1;
        }
        return Probe(args[1]);

    case "names":
        if (args.Length < 3)
        {
            Console.Error.WriteLine("Cách dùng: names \"<Series>\" \"<Title>\"");
            Console.Error.WriteLine("Ví dụ:     names \"E26\" \"test1\"");
            return 1;
        }
        return Names(args[1], args[2]);

    default:
        Console.Error.WriteLine($"Lệnh không biết: {args[0]}");
        return 1;
}

static int Probe(string inputPath)
{
    Source source;
    try
    {
        source = Source.Open(inputPath);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex.Message);
        Console.Error.WriteLine("Truyền vào một file .zip hoặc một thư mục chứa audio/ + các file PDF.");
        return 1;
    }

    using (source)
    {
        Console.WriteLine(source.Describe());
        Console.WriteLine();
        return ProbeSource(source);
    }
}

static int ProbeSource(Source source)
{
    var contents = ZipInspector.Inspect(source);

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

    foreach (var pdf in contents.Pdfs)
    {
        Console.WriteLine();
        Console.WriteLine($"  ▸ {pdf.Path}");
        Console.WriteLine($"    {pdf.Length / 1024.0 / 1024.0:F1} MB · đoán vai trò: {ZipInspector.GuessPdfRole(pdf.Name)}");

        try
        {
            using var ms = source.OpenSeekable(pdf.Path);
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

/// <summary>
/// In ra tên file mà server SẼ tự sinh cho một cặp (Series, Title) — để kiểm TRƯỚC khi
/// tạo đề, thay vì phát hiện sau khi import xong mà cả đề mất tiếng.
///
/// ⚠️ Hai bẫy lệnh này tồn tại để chặn, cả hai đều thất bại IM LẶNG (import báo thành công,
/// đến lúc thi mới biết không có audio):
///
///   1. Series: ToExamCode("ETS 2026") ra "ETS2026" chứ KHÔNG phải "E26" — vì bỏ dấu cách
///      thì chuỗi khớp ngay nhánh regex đầu. Mà "ETS 2026" đúng là ví dụ ghi trong comment
///      của Test.Series, nên làm theo tài liệu là sai.
///
///   2. Title: ToTestCode lấy SỐ ĐẦU TIÊN trong tiêu đề. "ETS 2026 - TEST 1" ra T2026,
///      không phải T01. Số thứ tự đề phải là số đầu tiên xuất hiện.
/// </summary>
static int Names(string series, string title)
{
    var exam = ToeicMediaNaming.ToExamCode(series);
    var test = ToeicMediaNaming.ToTestCode(title);

    Console.WriteLine($"Series = \"{series}\"   →  mã đề  : {exam}");
    Console.WriteLine($"Title  = \"{title}\"   →  mã test : {test}");
    Console.WriteLine();
    Console.WriteLine("Tên file server sẽ tự sinh:");
    Console.WriteLine($"  Part 1 câu 1        → {ToeicMediaNaming.BuildAudioFileName(series, title, 1, 1)}");
    Console.WriteLine($"  Part 1 câu 1 (ảnh)  → {ToeicMediaNaming.BuildImageFileName(series, title, 1)}");
    Console.WriteLine($"  Part 2 câu 7        → {ToeicMediaNaming.BuildAudioFileName(series, title, 2, 7)}");
    Console.WriteLine($"  Part 3 câu 32,33,34 → {ToeicMediaNaming.BuildAudioFileName(series, title, 3, 33)}  (3 câu chung 1 file)");
    Console.WriteLine($"  Part 4 câu 71,72,73 → {ToeicMediaNaming.BuildAudioFileName(series, title, 4, 72)}");
    Console.WriteLine();

    // Cảnh báo bẫy Title: số thứ tự đề phải là số ĐẦU TIÊN trong tiêu đề.
    var firstNumber = System.Text.RegularExpressions.Regex.Match(title, @"\d+");
    if (firstNumber.Success && firstNumber.Value.Length >= 4)
        Console.WriteLine($"  🔴 Title: số đầu tiên là \"{firstNumber.Value}\" nên mã test ra {test}. " +
                          "Số thứ tự đề PHẢI là số đầu tiên — sửa thành dạng \"test1\" hoặc \"TEST 1 - ETS 2026\".");

    Console.WriteLine("  So tên trên với tên file audio thật. Lệch một ký tự là cả đề mất tiếng,");
    Console.WriteLine("  và import vẫn báo thành công — không có lỗi nào cho bạn biết.");
    return 0;
}
