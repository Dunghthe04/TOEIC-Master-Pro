/**
 * Ghép URL media từ API (wwwroot/uploads/...) hoặc asset FE public (/exam/...).
 * uploads nằm ở gốc host, không dưới /api.
 */
export function getMediaUrl(path: string | null | undefined): string {
    if (!path) return ''
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    // File trong frontend/public — Vite phục vụ trực tiếp
    if (path.startsWith('/exam/')) return path
    const apiBase = (import.meta.env.VITE_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
    const origin = apiBase.replace(/\/api\/?$/i, '')
    // Dev không có VITE_BASE_URL: dùng path tương đối, Vite proxy /uploads → API
    if (!origin) return path.startsWith('/') ? path : `/${path}`
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`
}
