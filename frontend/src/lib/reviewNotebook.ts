/**
 * Sắp xếp nội dung SỔ TAY LỖI SAI thành thứ nhìn được: đề → cụm → câu.
 *
 * ─── VÌ SAO CẦN LỚP NÀY ─────────────────────────────────────────────────────────────
 *
 * API trả về một danh sách câu PHẲNG. Nhưng dữ liệu thật không phẳng:
 *
 *   - Câu 131–134 Part 6 dùng CHUNG một bài đọc.
 *   - Câu 41–43 Part 3 dùng CHUNG một file nghe.
 *
 * Vẽ phẳng thì mỗi thẻ tự mang đề bài của nó, và cùng một ảnh bài đọc bị lặp bốn lần —
 * đẩy câu hỏi xuống dưới màn hình, người học phải cuộn qua bốn bản sao của thứ họ vừa
 * đọc. Đúng lỗi mà `ExamAnswerReviewPanel` đã phải viết lại để sửa.
 *
 * Gốc rễ: đề bài thuộc về CỤM, không thuộc về câu. Đặt đúng cấp thì không còn gì để lặp.
 */
import { partToNumber } from '@/lib/examListening'
import { parseQuestionImageUrls, readingGroupKey } from '@/lib/examReading'
import type { ReviewQuestionItem } from '@/types/review.types'

export type TestGroup = { testId: string | null; title: string; clusters: ReviewCluster[] }

/**
 * Một cụm để luyện lại — bằng đúng MỘT màn lúc thi.
 *
 * `audioUrl` và `imageUrls` nằm ở cấp cụm chứ không ở cấp câu, vì đó là sự thật của dữ
 * liệu chứ không phải một mẹo chống lặp.
 */
export type ReviewCluster = {
    key: string
    /** true khi cả cụm chỉ có một câu và đề bài là của riêng câu đó (Part 1, 2, 5). */
    standalone: boolean
    audioUrl: string | null
    imageUrls: string[]
    items: ReviewQuestionItem[]
}

/**
 * Câu này chia sẻ đề bài với những câu nào.
 *
 * null = không chia sẻ với ai, đề bài là của riêng nó.
 *
 * Part 6–7 dùng LẠI `readingGroupKey` của màn thi, không tự viết luật gom mới — hai nơi
 * giữ hai bản quy tắc rồi lệch nhau là chuyện sớm muộn.
 */
function clusterKey(item: ReviewQuestionItem): string | null {
    const part = partToNumber(item.part)

    // Part 6–7: chung bài đọc (mã nhóm "131-134" trong cột Passage, hoặc chung file ảnh).
    if (part >= 6 && part <= 7) return readingGroupKey(item)

    // Part 3–4: 3 câu chung một file nghe. Sổ tay hiện chỉ có Reading, nhưng người học
    // thi Listening là có ngay — và lúc đó trình phát audio sẽ lặp ba lần nếu thiếu dòng
    // này. Rẻ hơn nhiều so với đợi có lỗi rồi mới sửa.
    if (part === 3 || part === 4) return item.audioUrl?.trim() ? `aud:${item.audioUrl.trim()}` : null

    // Part 1, 2, 5: mỗi câu một đề bài. Không có gì để gom.
    return null
}

/** Gom mọi ảnh trong cụm — giữ thứ tự, không trùng. */
function collectImageUrls(items: ReviewQuestionItem[]): string[] {
    const urls: string[] = []
    for (const item of items) {
        for (const url of parseQuestionImageUrls(item.imageUrl)) {
            if (!urls.includes(url)) urls.push(url)
        }
    }
    return urls
}

/**
 * Gom câu thành cụm.
 *
 * 🔴 Chỉ gom các câu LIỀN NHAU cùng khoá, không gom toàn cục. Danh sách đã được backend
 * xếp theo số câu nên câu cùng cụm luôn nằm cạnh nhau; gom toàn cục thì một câu lạc từ
 * chỗ khác sẽ bị kéo ngược lên, và thứ tự hiện ra không còn là thứ tự đề thi nữa.
 *
 * 🔴 Cụm ở đây THƯỜNG KHÔNG ĐỦ câu. Sổ tay chỉ chứa câu làm sai, nên cụm 131–134 có thể
 * chỉ còn 131 và 134. Vì vậy nhãn cụm phải liệt kê đúng số câu đang có, không được viết
 * thành khoảng "131–134" — viết khoảng là hứa hai câu không hề có mặt.
 */
export function buildClusters(items: ReviewQuestionItem[]): ReviewCluster[] {
    const clusters: ReviewCluster[] = []

    for (const item of items) {
        const key = clusterKey(item)
        const last = clusters.at(-1)

        if (key !== null && last && !last.standalone && last.key === key) {
            last.items.push(item)
            continue
        }

        clusters.push({
            // Câu đứng một mình vẫn cần khoá duy nhất để làm React key — dùng chính id câu.
            key: key ?? `q:${item.questionId}`,
            standalone: key === null,
            audioUrl: item.audioUrl,
            imageUrls: [],
            items: [item],
        })
    }

    // Gom ảnh SAU khi chốt thành viên: một cụm Part 7 có thể có 2–3 văn bản nằm rải ở
    // nhiều câu khác nhau, phải đủ thành viên mới biết cụm thật sự có mấy ảnh.
    for (const cluster of clusters) {
        cluster.imageUrls = collectImageUrls(cluster.items)
    }

    return clusters
}

/**
 * Gom cụm thành từng nhóm đề.
 *
 * Quét TUẦN TỰ chứ không gom bằng Map: backend đã xếp sẵn theo đề rồi theo số câu, nên
 * quét tuần tự vừa giữ đúng thứ tự đó, vừa không thể tự ý sinh ra một thứ tự thứ hai
 * lệch với thanh lọc bên trên.
 */
export function groupByTest(items: ReviewQuestionItem[]): TestGroup[] {
    const groups: { testId: string | null; title: string; items: ReviewQuestionItem[] }[] = []

    for (const item of items) {
        const last = groups.at(-1)
        if (last && last.testId === item.testId) {
            last.items.push(item)
        } else {
            groups.push({
                testId: item.testId,
                title: item.testTitle ?? 'Không rõ đề',
                items: [item],
            })
        }
    }

    // Chia cụm TRONG TỪNG ĐỀ, không chia trên cả danh sách: hai đề khác nhau vẫn có thể
    // trùng mã nhóm "131-134", gom chung là dán bài đọc của đề này lên câu của đề kia.
    return groups.map((g) => ({
        testId: g.testId,
        title: g.title,
        clusters: buildClusters(g.items),
    }))
}
