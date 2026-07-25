/**
 * Thông báo lỗi media khi thi — rõ ràng cho thí sinh, không hiện path kỹ thuật.
 */
import { partToNumber } from '@/lib/examListening'

/** Lấy tên file từ URL media */
export function mediaFileName(url: string): string {
    const clean = url.split('?')[0]
    return clean.split('/').filter(Boolean).pop() ?? url
}

/** Định dạng dải câu: [32,33,34] → "câu 32–34" */
export function formatQuestionRange(orderIndexes: number[]): string {
    if (orderIndexes.length === 0) return 'phần đang nghe'
    const sorted = [...orderIndexes].sort((a, b) => a - b)
    if (sorted.length === 1) return `câu ${sorted[0]}`
    if (sorted.length === 2) return `câu ${sorted[0]} và ${sorted[1]}`
    return `câu ${sorted[0]}–${sorted[sorted.length - 1]}`
}

export type AudioErrorContext = {
    kind: 'directions' | 'question'
    part: string
    orderIndexes?: number[]
    url: string
}

/** Thông báo khi không phát được audio Listening */
export function formatListeningAudioError(ctx: AudioErrorContext): string {
    const partNum = partToNumber(ctx.part)
    const partLabel = partNum ? `Listening Part ${partNum}` : 'Listening'
    const fileName = mediaFileName(ctx.url)

    if (ctx.kind === 'directions') {
        return `${partLabel}: không phát được audio hướng dẫn (file "${fileName}"). Đề thi có thể chưa được cấu hình đủ — hãy báo quản trị hoặc thử đề khác.`
    }

    const range = ctx.orderIndexes?.length
        ? formatQuestionRange(ctx.orderIndexes)
        : 'phần đang nghe'

    return `${partLabel}, ${range}: không tìm thấy file âm thanh "${fileName}". Bạn vẫn có thể chọn đáp án; nếu không nghe được, hãy tải lại trang hoặc đổi đề.`
}
