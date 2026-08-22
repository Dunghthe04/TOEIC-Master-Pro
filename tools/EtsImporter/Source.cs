using System.IO.Compression;

namespace EtsImporter;

/// <summary>
/// Nguồn đề: một file .zip HOẶC một thư mục.
///
/// VÌ SAO CHO PHÉP CẢ THƯ MỤC: bộ ETS có ~540 file audio, cả bộ vài trăm MB. Bắt nén lại
/// mỗi lần muốn kiểm là mất vài phút cho một lệnh chỉ đọc metadata — và người ta sẽ bỏ
/// không kiểm. Thư mục cho vòng lặp thử-sửa nhanh; ZIP cho lúc nhận nguyên bộ từ người khác.
///
/// Cùng một code phân loại và kiểm kê chạy cho cả hai, nên không có chuyện "chạy thư mục
/// thì đúng mà chạy zip lại khác".
/// </summary>
public abstract class Source : IDisposable
{
    public abstract IEnumerable<(string Path, string Name, long Length)> List();

    /// <summary>Mở một entry thành stream SEEK ĐƯỢC (PdfPig cần seek, stream của zip thì không).</summary>
    public abstract Stream OpenSeekable(string path);

    public abstract string Describe();

    public static Source Open(string path)
    {
        if (Directory.Exists(path)) return new FolderSource(path);
        if (File.Exists(path) && Path.GetExtension(path).Equals(".zip", StringComparison.OrdinalIgnoreCase))
            return new ZipSource(path);

        throw new ArgumentException(
            $"Không phải thư mục cũng không phải file .zip: {path}");
    }

    public virtual void Dispose() { }
}

public sealed class FolderSource(string root) : Source
{
    public override IEnumerable<(string, string, long)> List()
    {
        foreach (var f in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
        {
            var rel = Path.GetRelativePath(root, f).Replace('\\', '/');
            long len;
            try { len = new FileInfo(f).Length; }
            catch { continue; }   // file bị xoá/khoá giữa lúc quét — bỏ qua, không làm sập lệnh
            yield return (rel, Path.GetFileName(f), len);
        }
    }

    public override Stream OpenSeekable(string path)
        => File.OpenRead(Path.Combine(root, path.Replace('/', Path.DirectorySeparatorChar)));

    public override string Describe() => $"THƯ MỤC: {root}";
}

public sealed class ZipSource : Source
{
    private readonly string _path;
    private readonly ZipArchive _zip;

    public ZipSource(string path)
    {
        _path = path;
        _zip = ZipFile.OpenRead(path);
    }

    public override IEnumerable<(string, string, long)> List()
    {
        foreach (var e in _zip.Entries)
        {
            if (string.IsNullOrEmpty(e.Name)) continue;   // entry thư mục
            yield return (e.FullName.Replace('\\', '/'), e.Name, e.Length);
        }
    }

    public override Stream OpenSeekable(string path)
    {
        var entry = _zip.GetEntry(path)
            ?? _zip.Entries.FirstOrDefault(e => e.FullName.Replace('\\', '/') == path)
            ?? throw new FileNotFoundException($"Không thấy entry trong zip: {path}");

        // Copy ra memory: stream của ZipArchive không seek được, mà PdfPig cần seek.
        var ms = new MemoryStream();
        using (var es = entry.Open()) es.CopyTo(ms);
        ms.Position = 0;
        return ms;
    }

    public override string Describe()
        => $"ZIP: {_path} ({new FileInfo(_path).Length / 1024.0 / 1024.0:F1} MB)";

    public override void Dispose() => _zip.Dispose();
}
