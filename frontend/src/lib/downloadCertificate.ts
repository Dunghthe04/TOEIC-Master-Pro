/**
 * Xuất chứng chỉ SAMPLE ra file PNG — dùng html-to-image chụp DOM.
 */
import { toPng } from 'html-to-image'

/** Tên file an toàn: TOEIC-SAMPLE-ETS2026-Test-01-2026-07-24.png */
export function buildCertificateFilename(testSeries: string, testTitle: string): string {
    const safe = (s: string) =>
        s
            .trim()
            .replace(/[^\w\u00C0-\u024f\u1E00-\u1EFF-]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'certificate'
    const date = new Date().toISOString().slice(0, 10)
    return `TOEIC-SAMPLE-${safe(testSeries)}-${safe(testTitle)}-${date}.png`
}

/** Chụp phần tử HTML và kích hoạt tải PNG */
export async function downloadElementAsPng(
    element: HTMLElement,
    filename: string
): Promise<void> {
    const dataUrl = await toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
    })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
}
