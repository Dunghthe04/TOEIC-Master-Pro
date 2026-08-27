/**
 * Helper Exam Engine Reading (Day 28 Bước 6).
 *
 * Part 5: 1 câu / màn (điền khuyết).
 * Part 6–7: gom câu cùng passage (mã nhóm) hoặc cùng ảnh → 1 nhóm.
 * Một nhóm có thể có nhiều ảnh (double passage Part 7).
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

/** Tách nhiều file ảnh trong 1 ô ImageFile: a.png;b.png */
export function parseQuestionImageUrls(imageUrl: string | null | undefined): string[] {
    if (!imageUrl?.trim()) return []
    return imageUrl
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
}

/** Mã nhóm Excel (vd. 186-190) — không phải nội dung đoạn văn */
export function isPassageGroupCode(passage: string | null | undefined): boolean {
    if (!passage?.trim()) return false
    return /^\d+\s*-\s*\d+$/.test(passage.trim())
}

/** 1 màn Reading: 1 câu (P5) hoặc passage/ảnh + nhiều câu (P6–7) */
export type ReadingItem =
    | { kind: 'single'; question: PlayQuestion }
    | {
          kind: 'passage'
          passage: string
          /** Một hoặc nhiều ảnh bài đọc trong cùng unit */
          imageUrls: string[]
          questions: PlayQuestion[]
      }

/**
 * Khóa nhóm Part 6–7.
 * Ưu tiên Passage (kể cả mã nhóm "151-154") để nhiều ảnh/câu gộp 1 unit.
 *
 * Nhận kiểu theo CẤU TRÚC chứ không phải `PlayQuestion`: sổ tay lỗi sai có kiểu câu
 * riêng (`ReviewQuestionItem`) nhưng phải chia cụm y hệt màn thi. Nới kiểu ở đây rẻ hơn
 * nhiều so với để hai nơi giữ hai bản quy tắc gom nhóm rồi lệch nhau.
 */
export function readingGroupKey(q: {
    passage?: string | null
    imageUrl?: string | null
}): string | null {
    const passage = q.passage?.trim()
    if (passage) return `pass:${passage}`
    const image = q.imageUrl?.trim()
    if (image) return `img:${image}`
    return null
}

/** Gom mọi ảnh trong nhóm — giữ thứ tự, không trùng */
function collectGroupImageUrls(group: PlayQuestion[]): string[] {
    const urls: string[] = []
    for (const q of group) {
        for (const u of parseQuestionImageUrls(q.imageUrl)) {
            if (!urls.includes(u)) urls.push(u)
        }
    }
    return urls
}

/**
 * Gom câu 1 Part Reading thành danh sách màn.
 * Part 6–7: dòng liên tiếp cùng khóa nhóm → 1 item (có thể nhiều ảnh).
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
        const groupKey = partNum >= 6 && partNum <= 7 ? readingGroupKey(q) : null

        if (groupKey) {
            const group: PlayQuestion[] = [q]
            let j = i + 1
            while (j < partQs.length && readingGroupKey(partQs[j]) === groupKey) {
                group.push(partQs[j])
                j++
            }
            const passage =
                group.map((x) => x.passage?.trim()).find((p) => p) ?? ''
            items.push({
                kind: 'passage',
                passage,
                imageUrls: collectGroupImageUrls(group),
                questions: group,
            })
            i = j
            continue
        }

        items.push({ kind: 'single', question: q })
        i++
    }

    return items
}

/** Ô điều hướng 1 câu Reading — dùng bảng soát câu */
export type ReadingNavQuestion = {
    question: PlayQuestion
    partIdx: number
    readingItemIdx: number
}

export type ReadingNavPartGroup = {
    part: string
    partNum: number
    partIdx: number
    questions: ReadingNavQuestion[]
}

/** Gom câu Reading theo Part để hiển thị lưới số câu */
export function buildReadingNavByPart(
    allQuestions: PlayQuestion[],
    partsOrder: string[]
): ReadingNavPartGroup[] {
    return partsOrder.map((part, partIdx) => {
        const items = buildReadingItemsForPart(allQuestions, part)
        const questions: ReadingNavQuestion[] = []

        items.forEach((item, readingItemIdx) => {
            if (item.kind === 'single') {
                questions.push({ question: item.question, partIdx, readingItemIdx })
            } else {
                for (const q of item.questions) {
                    questions.push({ question: q, partIdx, readingItemIdx })
                }
            }
        })

        return {
            part,
            partNum: partToNumber(part),
            partIdx,
            questions: questions.sort((a, b) => a.question.orderIndex - b.question.orderIndex),
        }
    })
}
