/**
 * Phát hiện element đã cuộn vào tầm nhìn chưa — dùng cho hiệu ứng "hiện dần" ở landing page.
 *
 * Vì sao IntersectionObserver, không phải listener 'scroll':
 * 'scroll' bắn hàng trăm lần mỗi giây và phải tự tính getBoundingClientRect (gây reflow).
 * IntersectionObserver để trình duyệt tự theo dõi, chỉ gọi callback khi trạng thái ĐỔI.
 *
 * once = true (mặc định): hiện rồi thì thôi, không ẩn lại khi cuộn ngược — cuộn lên
 * cuộn xuống mà nội dung nhấp nháy thì rất khó chịu.
 */
import { useEffect, useRef, useState } from 'react'

export function useInView<T extends HTMLElement = HTMLDivElement>(
    options: { threshold?: number; once?: boolean } = {}
) {
    const { threshold = 0.15, once = true } = options
    const ref = useRef<T | null>(null)
    const [inView, setInView] = useState(false)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        // Tôn trọng prefers-reduced-motion: người dùng tắt animation trong OS thì
        // hiện luôn, không chờ cuộn. Bỏ qua điều này là lỗi accessibility.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setInView(true)
            return
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true)
                    if (once) observer.disconnect()
                } else if (!once) {
                    setInView(false)
                }
            },
            { threshold }
        )

        observer.observe(el)
        return () => observer.disconnect()
    }, [threshold, once])

    return { ref, inView }
}
