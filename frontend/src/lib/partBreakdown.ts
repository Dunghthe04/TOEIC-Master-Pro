import type { PartBreakdownItem } from '@/types/test-session.types'

/** Part 1–4 Listening, 5–7 Reading */
export function partSkillLabel(part: number): 'Listening' | 'Reading' {
    return part <= 4 ? 'Listening' : 'Reading'
}

export function formatPartLabel(part: number): string {
    return `Part ${part}`
}

/**
 * Part có accuracy thấp nhất — có thể nhiều Part nếu hòa điểm.
 */
export function getWeakestPartNumbers(items: PartBreakdownItem[]): number[] {
    if (items.length === 0) return []
    const minAccuracy = Math.min(...items.map((i) => i.accuracyPercent))
    return items.filter((i) => i.accuracyPercent === minAccuracy).map((i) => i.part)
}

/** Màu thanh % theo ngưỡng (giống dashboard luyện thi). */
export function accuracyBarColor(percent: number): string {
    if (percent >= 80) return 'bg-emerald-500'
    if (percent >= 60) return 'bg-amber-500'
    return 'bg-red-500'
}
