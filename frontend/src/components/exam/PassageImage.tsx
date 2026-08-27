/**
 * Ảnh bài đọc Part 6–7 — hiện ở TỈ LỆ CỐ ĐỊNH, không kéo giãn cho vừa cột.
 *
 * Dùng ở CẢ BA nơi có bài đọc: màn thi (`MockTestPlayPage`), màn xem lại kết quả, và sổ
 * tay lỗi sai. Ba nơi cùng một loại ảnh thì phải cùng một cỡ chữ — để mỗi nơi tự vẽ
 * `<img>` là sớm muộn lại có nơi quay về `w-full` và tái lập đúng lỗi dưới đây.
 */
import { useCallback, useState } from 'react'
import { getMediaUrl } from '@/lib/media'

/**
 * Hệ số thu nhỏ ảnh bài đọc.
 *
 * Ảnh được cắt từ trang PDF ở 200 DPI, nên SỐ PIXEL CỦA CHÚNG ĐÃ TỈ LỆ ĐÚNG với kích
 * thước thật trên giấy. Chỉ cần nhân tất cả với cùng một hệ số là mọi bài đọc ra đúng
 * một cỡ chữ — đúng như khi cầm tờ đề trên tay.
 *
 * 0.7 chọn theo số đo thật của đề 1: bản thông báo rộng 1143px là ảnh đang hiển thị đẹp
 * nhất (cột rộng ~840px → đang ở tỉ lệ 0.73). Giữ nguyên cỡ đó, những ảnh còn lại tự khớp
 * theo.
 */
export const PassageImageScale = 0.7

/**
 * 🔴 LỖI CŨ: ảnh dùng `w-full`, tức mọi ảnh đều bị kéo cho bằng bề ngang cột (~840px)
 * bất kể nó rộng bao nhiêu. Số đo thật của đề 1 cho thấy hậu quả:
 *
 *   thông báo 147-148   1143px → 840px   thu nhỏ 0.73×   ✅ đẹp
 *   tin nhắn  149-150    813px → 840px   PHÓNG TO 1.03×  ❌ chữ to
 *   bài báo   153-154    555px → 840px   PHÓNG TO 1.51×  ❌ chữ rất to, lại còn mờ
 *
 * Ảnh càng HẸP thì càng bị phóng to — mà ảnh hẹp chính là mấy ảnh dọc (điện thoại, cột
 * báo). Cùng một cỡ chữ trên giấy in mà ra ba cỡ khác nhau trên màn hình, và ảnh bị
 * phóng quá 100% thì vỡ nét vì không có thêm pixel nào để phóng.
 *
 * CÁCH SỬA: nhân bề ngang thật với {@link PassageImageScale} — một hệ số DÙNG CHUNG cho
 * mọi ảnh. Không bao giờ phóng to quá kích thước thật, nên không còn ảnh mờ.
 *
 * `max-w-full` vẫn giữ: ảnh nào sau khi thu nhỏ vẫn rộng hơn cột thì thu tiếp cho vừa,
 * không tràn ngang.
 */
export default function PassageImage({ url, bordered }: { url: string; bordered: boolean }) {
    const [width, setWidth] = useState<number>()

    // Đọc bề ngang thật ngay khi ảnh sẵn sàng. Cần CẢ hai đường: onLoad cho ảnh tải mới,
    // và ref cho ảnh đã nằm sẵn trong cache trình duyệt — ảnh cache có thể xong TRƯỚC khi
    // React kịp gắn onLoad, và khi đó sự kiện không bao giờ bắn.
    const measure = useCallback((el: HTMLImageElement | null) => {
        if (el?.complete && el.naturalWidth > 0) {
            setWidth(el.naturalWidth * PassageImageScale)
        }
    }, [])

    return (
        <img
            ref={measure}
            src={getMediaUrl(url)}
            alt="Bài đọc"
            onLoad={(e) => setWidth(e.currentTarget.naturalWidth * PassageImageScale)}
            style={width ? { width } : undefined}
            // mx-auto: ảnh hẹp giờ không lấp kín cột nữa, để lệch trái thì phần trắng dồn
            // hết sang phải, trông như lỗi tràn. Căn giữa thì khoảng trắng chia đều hai bên
            // và đọc ra là có chủ ý.
            className={`block mx-auto max-w-full h-auto bg-white ${bordered ? 'border-2 border-slate-800' : ''}`}
        />
    )
}
