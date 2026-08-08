/**
 * Đưa popup đăng nhập Google ra GIỮA cửa sổ trình duyệt.
 *
 * VẤN ĐỀ: Google Identity Services tự tính toạ độ popup rồi gọi `window.open`.
 * Phép tính đó dựa trên kích thước MÀN HÌNH, nên với màn rộng, có scaling, hoặc
 * nhiều màn hình thì popup văng ra sát mép trái — che mất giao diện và nhìn như lỗi.
 *
 * VÌ SAO PHẢI VÁ Ở `window.open` CHỨ KHÔNG PHẢI Ở CHỖ BẤM NÚT: `<GoogleLogin>` render
 * nút bằng **iframe của Google**, click nằm trong iframe nên React không nhận được
 * sự kiện. Không có lúc-bấm-nút để chen vào, chỉ còn lúc-mở-cửa-sổ.
 *
 * Gọi MỘT LẦN lúc app khởi động (main.tsx), trước khi render.
 */

/** Chỉ đụng vào popup của Google, không đụng popup/tab nào khác của app. */
function isGoogleAuthPopup(url: string, features: string): boolean {
    // Popup có kích thước (width+height) mới là "cửa sổ", còn `_blank` không kèm
    // kích thước là mở tab thường — vd nút tải file .ics ở ExamSchedulePage.
    const isSizedWindow = /\bwidth=/.test(features) && /\bheight=/.test(features)
    if (!isSizedWindow) return false

    // GIS đôi khi mở cửa sổ RỖNG trước rồi mới trỏ sang accounts.google.com,
    // nên phải chấp nhận cả trường hợp url trống.
    return url === '' || url === 'about:blank' || url.includes('accounts.google.com')
}

/** Ghi đè `left`/`top` trong chuỗi features, giữ nguyên mọi tham số khác. */
function recenter(features: string): string {
    const spec = new Map<string, string>()
    for (const part of features.split(',')) {
        const [key, value] = part.split('=')
        if (key?.trim()) spec.set(key.trim(), (value ?? '').trim())
    }

    const width = Number(spec.get('width')) || 500
    const height = Number(spec.get('height')) || 600

    // screenLeft/screenTop = vị trí cửa sổ trình duyệt trên TOÀN BỘ desktop.
    // Căn theo cửa sổ chứ không theo màn hình, nên kéo app sang màn phụ vẫn đúng.
    const baseLeft = window.screenLeft ?? window.screenX ?? 0
    const baseTop = window.screenTop ?? window.screenY ?? 0
    const frameWidth = window.outerWidth || window.innerWidth
    const frameHeight = window.outerHeight || window.innerHeight

    // Math.max(0, …) chặn toạ độ âm khi cửa sổ trình duyệt hẹp hơn popup —
    // toạ độ âm là trình duyệt đẩy popup ra ngoài màn hình, mất luôn.
    spec.set('left', String(Math.max(0, Math.round(baseLeft + (frameWidth - width) / 2))))
    spec.set('top', String(Math.max(0, Math.round(baseTop + (frameHeight - height) / 2))))

    return [...spec].map(([key, value]) => (value ? `${key}=${value}` : key)).join(',')
}

export function centerGooglePopup(): void {
    const originalOpen = window.open.bind(window)

    window.open = (url?: string | URL, target?: string, features?: string) => {
        const href = typeof url === 'string' ? url : (url?.toString() ?? '')

        // Không phải popup Google → trả nguyên hành vi gốc, không đụng gì.
        if (typeof features !== 'string' || !isGoogleAuthPopup(href, features)) {
            return originalOpen(url, target, features)
        }

        return originalOpen(url, target, recenter(features))
    }
}
