/**
 * Helper Exam Engine Listening (Day 27).
 *
 * Vai trò: chuẩn bị "playlist" trước khi MockTestPlayPage phát audio.
 * - buildListeningUnits: gom câu thành unit (1 audio = 1 hoặc 3 câu)
 * - listeningPartsInOrder: thứ tự Part 1 → 2 → 3 → 4
 */
import type { PlayQuestion } from '@/types/test.types'

/** Chuyển "Part3" hoặc "Part 3" → số 3 */
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
 * Gom câu Listening thành danh sách unit để phát tuần tự.
 *
 * Part 1–2: mỗi câu = 1 unit = 1 file mp3
 *   Câu 7 → ETS26-T01-7.mp3
 *
 * Part 3–4: 3 câu liên tiếp cùng audioUrl = 1 unit = 1 file mp3
 *   Câu 38, 39, 40 → ETS26-T01-38-40.mp3 (hiện 3 câu cùng lúc trên UI)
 *
 * MockTestPlayPage dùng units[unitIdx] — hết audio unit → advanceAfterUnit()
 */
export function buildListeningUnits(questions: PlayQuestion[]): ListeningUnit[] {
    const listening = questions.filter((q) => isListeningPart(q.part))
    const units: ListeningUnit[] = []
    let i = 0

    while (i < listening.length) {
        const q = listening[i]
        const n = partToNumber(q.part)

        // Part 3–4: gộp các câu liên tiếp có cùng audioUrl thành 1 unit
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

        // Part 1–2: 1 câu = 1 unit
        units.push({ audioUrl: q.audioUrl, questions: [q], part: q.part })
        i++
    }

    return units
}

/** Part Listening có trong đề, giữ thứ tự xuất hiện: Part1, Part2, Part3, Part4 */
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