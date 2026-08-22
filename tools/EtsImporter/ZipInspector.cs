using System.IO.Compression;

namespace EtsImporter;

/// <summary>Một entry đáng quan tâm trong ZIP.</summary>
public record ZipItem(string Path, string Name, long Length);

/// <summary>Kết quả phân loại nội dung ZIP.</summary>
public class ZipContents
{
    public List<ZipItem> Audio { get; } = [];
    public List<ZipItem> Pdfs { get; } = [];
    public List<ZipItem> Images { get; } = [];
    public List<ZipItem> Others { get; } = [];

    /// <summary>File rác đã lọc — đếm để BÁO CHO NGƯỜI DÙNG, không im lặng bỏ qua.</summary>
    public List<ZipItem> Junk { get; } = [];

    /// <summary>ZIP lồng trong ZIP — báo để biết còn phải giải nén thêm một lớp.</summary>
    public List<ZipItem> NestedZips { get; } = [];
}

public static class ZipInspector
{
    /// <summary>
    /// Nhận diện file rác do hệ điều hành sinh ra, KHÔNG phải nội dung đề.
    ///
    /// ⚠️ VÌ SAO PHẢI LỌC — bẫy thật đã gặp: bộ ETS được nén trên máy Mac nên mỗi file
    /// audio có một file bạn đồng hành "._E26-T08-83-85.mp3" nặng 187 byte (AppleDouble
    /// resource fork — macOS lưu metadata ở đó vì hệ thống file khác không có khái niệm
    /// resource fork).
    ///
    /// Để lọt vào import thì hậu quả không phải lỗi mà là ĐIỀU TỆ HƠN: server nhận một
    /// file .mp3 "hợp lệ" 187 byte, không câu hỏi nào tham chiếu tới nó, và số file audio
    /// nhìn vào thấy GẤP ĐÔI thực tế → tưởng đã đủ audio trong khi có thể đang thiếu.
    /// </summary>
    private static bool IsJunk(string fullPath, string name)
    {
        // Chuẩn hoá dấu phân cách: ZIP dùng '/', nhưng file nén trên Windows có thể ra '\'
        var path = fullPath.Replace('\\', '/');

        if (path.StartsWith("__MACOSX/", StringComparison.OrdinalIgnoreCase)
            || path.Contains("/__MACOSX/", StringComparison.OrdinalIgnoreCase))
            return true;

        if (name.StartsWith("._", StringComparison.Ordinal)) return true;
        if (name.Equals(".DS_Store", StringComparison.OrdinalIgnoreCase)) return true;
        if (name.Equals("Thumbs.db", StringComparison.OrdinalIgnoreCase)) return true;

        return false;
    }

    public static ZipContents Inspect(string zipPath)
    {
        var result = new ZipContents();
        using var zip = ZipFile.OpenRead(zipPath);

        foreach (var e in zip.Entries)
        {
            // Name rỗng = entry thư mục, không phải file.
            if (string.IsNullOrEmpty(e.Name)) continue;

            var item = new ZipItem(e.FullName.Replace('\\', '/'), e.Name, e.Length);

            if (IsJunk(e.FullName, e.Name)) { result.Junk.Add(item); continue; }

            var ext = Path.GetExtension(e.Name).ToLowerInvariant();
            switch (ext)
            {
                case ".mp3":
                case ".m4a":
                case ".wav":
                    result.Audio.Add(item);
                    break;
                case ".pdf":
                    result.Pdfs.Add(item);
                    break;
                case ".jpg":
                case ".jpeg":
                case ".png":
                    result.Images.Add(item);
                    break;
                case ".zip":
                    result.NestedZips.Add(item);
                    break;
                default:
                    result.Others.Add(item);
                    break;
            }
        }

        return result;
    }

    /// <summary>
    /// Đoán vai trò của từng PDF theo tên file. CHỈ LÀ PHỎNG ĐOÁN — probe in ra để người
    /// dùng xác nhận, không tự tin dùng luôn: đặt tên file là việc của người tạo bộ đề,
    /// không có gì bảo đảm.
    /// </summary>
    public static string GuessPdfRole(string name)
    {
        var n = name.ToLowerInvariant();

        if (n.Contains("transcript") || n.Contains("script")) return "transcript?";
        if (n.Contains("answer") || n.Contains("key") || n.Contains("dap an")) return "đáp án?";
        if (n.Contains("listening") || n.Contains("lc")) return "listening?";
        if (n.Contains("reading") || n.Contains("rc")) return "reading?";

        return "chưa rõ";
    }
}
