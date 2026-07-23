/**

 * Quy ước tên file media (khớp backend ToeicMediaNaming).

 * Part 1–2: E26-T01-1.mp3 | Part 3–4: E26-T01-38-40.mp3

 */

export function toExamCode(series: string): string {

    const s = series?.trim().replace(/\s/g, '') ?? ''

    if (/^[A-Za-z]{1,6}\d{1,4}$/.test(s)) return s.toUpperCase()

    const m = series?.match(/20(\d{2})/)

    if (m) return `E${m[1]}`

    const letters = series?.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()

    return letters || 'EXAM'

}



export function toTestCode(title: string): string {

    const m = title?.match(/(\d+)/)

    return m ? `T${m[1].padStart(2, '0')}` : 'T01'

}



/** Khoảng số câu trong tên file (Part 3–4 = nhóm 3 câu). */

export function getAudioOrderRange(

    part: number,

    orderIndex: number

): { start: number; end: number } {

    if (part === 3 && orderIndex >= 32) {

        const start = 32 + Math.floor((orderIndex - 32) / 3) * 3

        return { start, end: start + 2 }

    }

    if (part === 4 && orderIndex >= 71) {

        const start = 71 + Math.floor((orderIndex - 71) / 3) * 3

        return { start, end: start + 2 }

    }

    return { start: orderIndex, end: orderIndex }

}



export function buildAudioFileName(

    series: string,

    title: string,

    part: number,

    orderIndex: number

): string {

    const exam = toExamCode(series)

    const test = toTestCode(title)

    const { start, end } = getAudioOrderRange(part, orderIndex)

    return start === end

        ? `${exam}-${test}-${start}.mp3`

        : `${exam}-${test}-${start}-${end}.mp3`

}

