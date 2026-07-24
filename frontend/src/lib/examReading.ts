/**
 * Helper Exam Engine Reading (Day 28 Bước 6).
 *
 * Part 5: 1 câu / màn (điền khuyết).
 * Part 6–7: gom câu cùng passage → 1 nhóm (passage trái, câu phải).
 */
import type { PlayQuestion } from '@/types/test.types'
import { partToNumber } from '@/lib/examListening'

export function isReadingPart(part: string): boolean {
    const n = partToNumber(part)
    return n >= 5 && n <= 7
}

/** Part Reading có trong gói play, theo thứ tự 5 → 6 → 7 */
export function readingPartsInOrder(questions: PlayQuestion[]): string[] {
    const seen = new Set<string>()
    const order: string[] = []
    for (const q of questions) {
        if (!isReadingPart(q.part) || seen.has(q.part)) continue
        seen.add(q.part)
        order.push(q.part)
    }
    return order
}

/** 1 màn Reading: 1 câu (P5) hoặc 1 passage + nhiều câu (P6–7) */
export type ReadingItem =
    | { kind: 'single'; question: PlayQuestion }
    | { kind: 'passage'; passage: string; questions: PlayQuestion[] }

/**
 * Gom câu 1 Part Reading thành danh sách màn.
 * Part 6–7: các dòng liên tiếp có cùng passage → 1 item.
 */
export function buildReadingItemsForPart(
    questions: PlayQuestion[],
    part: string
): ReadingItem[] {
    const partQs = questions
        .filter((q) => q.part === part)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    const items: ReadingItem[] = []
    const partNum = partToNumber(part)
    let i = 0

    while (i < partQs.length) {
        const q = partQs[i]
        const passage = q.passage?.trim() ?? ''

        if (partNum >= 6 && partNum <= 7 && passage) {
            const group: PlayQuestion[] = [q]
            let j = i + 1
            while (
                j < partQs.length &&
                (partQs[j].passage?.trim() ?? '') === passage
            ) {
                group.push(partQs[j])
                j++
            }
            items.push({ kind: 'passage', passage, questions: group })
            i = j
            continue
        }

        items.push({ kind: 'single', question: q })
        i++
    }

    return items
}
