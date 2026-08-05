/**
 * Ghép URL media từ API (/api/media/...) hoặc asset FE public (/exam/...).
 *
 * VÌ SAO CẦN TOKEN TRONG QUERY: thẻ <audio>/<img> do TRÌNH DUYỆT tải, không qua axios
 * nên không gắn Authorization header → 401. Backend nhận token qua ?t=.
 *
 * Token này KHÁC access token: sống 10 phút, chỉ đọc media CỦA MỘT ĐỀ. URL bị ghi vào
 * access log / Referer / history nên token trong URL phải hẹp và ngắn hạn.
 */
import api from '@/api/axios'

/** Cache token theo testId — mỗi đề một token riêng (backend ký testId vào chữ ký). */
const cache = new Map<string, { token: string; expiresAt: number }>()
/** Promise đang bay, gộp mọi lời gọi đồng thời cho cùng một đề. */
const inflight = new Map<string, Promise<string>>()

/**
 * Xin token media cho một đề. Tự cache tới khi gần hết hạn.
 * Gọi trước khi render media (xem prefetchMediaToken).
 */
async function fetchMediaToken(testId: string): Promise<string> {
    const hit = cache.get(testId)
    // Còn hạn (trừ 60s đệm để không dùng token sắp chết) → dùng lại
    if (hit && Date.now() < hit.expiresAt - 60_000) return hit.token

    const flying = inflight.get(testId)
    if (flying) return flying

    // Màn thi render ~100 thẻ <img> cùng lúc. Không gộp thì 100 request /token.
    // Cùng pattern với chống refresh-token-race.
    const p = api
        .get<{ token: string; expiresInSeconds: number }>(`/media/token/${testId}`)
        .then(res => {
            cache.set(testId, {
                token: res.data.token,
                expiresAt: Date.now() + res.data.expiresInSeconds * 1000,
            })
            return res.data.token
        })
        .finally(() => { inflight.delete(testId) })

    inflight.set(testId, p)
    return p
}

/**
 * Gọi ở đầu màn có media, TRƯỚC khi render <audio>/<img>.
 * Không có token thì getMediaUrl trả URL trần → 401 và ảnh/audio im lặng không hiện.
 */
export async function prefetchMediaToken(testId: string | null | undefined): Promise<void> {
    if (!testId) return
    try { await fetchMediaToken(testId) } catch { /* để 401 lộ ra thay vì che lỗi */ }
}

/** Xóa cache khi logout — token cũ không dùng lại ở tài khoản khác. */
export function clearMediaTokens(): void {
    cache.clear()
    inflight.clear()
}

export function getMediaUrl(path: string | null | undefined): string {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) return path

    // File trong frontend/public — Vite/Nginx phục vụ trực tiếp, KHÔNG cần token
    if (path.startsWith('/exam/')) return path

    const apiBase = (import.meta.env.VITE_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
    const origin = apiBase.replace(/\/api\/?$/i, '')
    const rel = path.startsWith('/') ? path : `/${path}`
    const url = origin ? `${origin}${rel}` : rel

    // Chỉ /api/media/tests/{testId}/... cần token. /uploads/avatars/... vẫn công khai.
    const m = /^\/api\/media\/tests\/([0-9a-fA-F-]{36})\//.exec(rel)
    if (!m) return url

    const entry = cache.get(m[1])
    if (!entry) return url   // chưa prefetch → URL trần, sẽ 401 (lỗi lộ ra, không im lặng)

    return `${url}${url.includes('?') ? '&' : '?'}t=${encodeURIComponent(entry.token)}`
}
