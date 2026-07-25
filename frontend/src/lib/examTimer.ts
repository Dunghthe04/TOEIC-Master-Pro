/**
 * Timer Reading — giống thi TOEIC thật: 75 phút khi vào phần Reading.
 */

/** Thời gian Reading chuẩn TOEIC L&R (giây) */
export const READING_SECTION_SECONDS = 10

/** Định dạng đếm ngược MM:SS — vd. 4500 → "75:00" */
export function formatExamCountdown(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds))
    const minutes = Math.floor(safe / 60)
    const seconds = safe % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Dưới ngưỡng này đổi màu cảnh báo (giây) */
export const READING_TIMER_WARNING_SECONDS = 5 * 60
