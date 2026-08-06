using Ganss.Xss;

namespace ToeicMasterPro.Infrastructure.Services;

/// <summary>
/// Lọc HTML do CM soạn trước khi lưu DB.
///
/// VÌ SAO CẦN: nội dung câu hỏi là HTML thật (đậm/nghiêng/bảng) nên frontend phải dùng
/// dangerouslySetInnerHTML — 15 chỗ. Thẻ đó TẮT auto-escape của React, nên HTML bẩn trong
/// DB sẽ chạy như code trong trình duyệt MỌI user làm đề đó (Stored XSS).
///
/// VÌ SAO Ở BACKEND, KHÔNG PHẢI TIN VÀO TIPTAP:
/// TipTap dùng ProseMirror schema nên payload gõ vào editor bị lọc — nhưng đó là bảo vệ
/// PHÍA CLIENT. Đã kiểm chứng: gọi POST /api/Question bằng curl thì onerror/script/
/// javascript: vào DB NGUYÊN VẸN. Editor lọc là tiện nghi, không phải kiểm soát bảo mật.
///
/// VÌ SAO WHITELIST, KHÔNG BLACKLIST:
/// Blacklist luôn thiếu — svg onload, iframe srcdoc, body onpageshow, javascript: trong
/// href, data:text/html... Whitelist mặc định TỪ CHỐI, chỉ cho qua thứ có trong danh sách.
///
/// Nguyên tắc: SANITIZE lúc GHI, ESCAPE lúc ĐỌC.
/// Singleton: HtmlSanitizer thread-safe sau khi cấu hình xong.
/// </summary>
public class HtmlContentSanitizer
{
    private readonly HtmlSanitizer _sanitizer;

    public HtmlContentSanitizer()
    {
        _sanitizer = new HtmlSanitizer();

        // Bắt đầu từ danh sách RỖNG — mặc định của thư viện khá rộng, tự khai lại cho chắc
        _sanitizer.AllowedTags.Clear();
        _sanitizer.AllowedAttributes.Clear();

        // Định dạng chữ — khớp toolbar TipTap StarterKit
        AddTags("b", "strong", "i", "em", "u", "s", "strike", "mark", "small", "sup", "sub");
        // Cấu trúc đoạn
        AddTags("p", "br", "div", "span", "hr");
        // Danh sách
        AddTags("ul", "ol", "li");
        // Bảng — Reading Part 7 có bảng biểu, lịch trình, hóa đơn
        AddTags("table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col");
        // Tiêu đề, trích dẫn, code
        AddTags("h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code");
        // Ảnh — Part 1/6/7
        AddTags("img");

        // Thuộc tính: chỉ thứ vô hại.
        // KHÔNG cho `style` — chứa được url(javascript:...) và expression() trên IE cũ.
        // KHÔNG BAO GIỜ cho on* — onerror/onload là đường XSS phổ biến nhất.
        AddAttrs("src", "alt", "title", "width", "height",
                 "colspan", "rowspan", "align", "valign", "class");

        // href/src chỉ nhận 2 scheme này → chặn javascript:, data:text/html, vbscript:
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.Add("http");
        _sanitizer.AllowedSchemes.Add("https");

        _sanitizer.AllowedCssProperties.Clear();   // không cho CSS inline
        _sanitizer.KeepChildNodes = true;          // <script>foo</script> → giữ chữ "foo"

        void AddTags(params string[] tags) { foreach (var t in tags) _sanitizer.AllowedTags.Add(t); }
        void AddAttrs(params string[] a) { foreach (var x in a) _sanitizer.AllowedAttributes.Add(x); }
    }

    /// <summary>Lọc HTML. null/rỗng trả về nguyên trạng (không đổi null thành "").</summary>
    public string? Clean(string? html)
        => string.IsNullOrWhiteSpace(html) ? html : _sanitizer.Sanitize(html);
}
