/**
 * Helper Exam Engine Listening (Day 27).
 * Mục đích: parse Part, gom Part 3–4 cùng audioUrl thành 1 “unit” phát.
 */
import type { PlayQuestion } from '@/types/test.types'

/** "Part3" → 3 */
export function partToNumber(part: string): number {
    const n = Number(String(part).replace(/\D/g, ''))
    return n >= 1 && n <= 7 ? n : 0
}

export function isListeningPart(part: string): boolean {
    const n = partToNumber(part)
    return n >= 1 && n <= 4
}

/** Một đơn vị phát: 1 audio + 1 câu (P1–2) hoặc nhóm 3 câu (P3–4). */
export type ListeningUnit = {
    audioUrl: string | null
    questions: PlayQuestion[]
    part: string
}

/**
 * Gom câu Listening thành playlist units.
 * Cùng audioUrl liên tiếp (Part 3–4) → 1 unit.
 */
export function buildListeningUnits(questions: PlayQuestion[]): ListeningUnit[] {
    const listening = questions.filter((q) => isListeningPart(q.part))
    const units: ListeningUnit[] = []
    let i = 0

    while (i < listening.length) {
        const q = listening[i]
        const n = partToNumber(q.part)

        // Part 3–4: gộp các câu cùng audioUrl đứng liền nhau
        if (n >= 3 && n <= 4 && q.audioUrl) {
            const group: PlayQuestion[] = [q]
            let j = i + 1
            while (
                j < listening.length &&
                partToNumber(listening[j].part) === n &&
                listening[j].audioUrl === q.audioUrl
            ) {
                group.push(listening[j])
                j++
            }
            units.push({ audioUrl: q.audioUrl, questions: group, part: q.part })
            i = j
            continue
        }

        units.push({ audioUrl: q.audioUrl, questions: [q], part: q.part })
        i++
    }

    return units
}

/** Danh sách Part Listening có trong gói play, theo thứ tự. */
export function listeningPartsInOrder(questions: PlayQuestion[]): string[] {
    const seen = new Set<string>()
    const order: string[] = []
    for (const q of questions) {
        if (!isListeningPart(q.part) || seen.has(q.part)) continue
        seen.add(q.part)
        order.push(q.part)
    }
    return order
}