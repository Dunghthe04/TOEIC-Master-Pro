// Định nghĩa TypeScript types khớp với TestSummaryResponse từ backend.
export interface TestSummary {
    id: string
    title: string
    series: string
    description: string | null
    durationMinutes: number
    isPublished: boolean
    questionCount: number
    createdByUserId: string
    createdAt: string
}

export interface CreateTestPayload {
    title: string
    series?: string
    description?: string
    durationMinutes: number
    isPublished: boolean
}

export interface UpdateTestPayload {
    title: string
    series?: string
    description?: string
    durationMinutes: number
    isPublished: boolean
}

/** Câu đã gắn vào đề (GET /api/test/{id}) */
export interface TestQuestionItem {
    questionId: string
    orderIndex: number
    content: string
    part: string // "Part1" …
}

/** Chi tiết đề kèm danh sách câu đã gán */
export interface TestDetail {
    id: string
    title: string
    description: string | null
    durationMinutes: number
    isPublished: boolean
    createdByUserId: string
    createdAt: string
    questions: TestQuestionItem[]
}

/** Body POST /api/test/{id}/questions */
export interface AddQuestionsPayload {
    items: { questionId: string; orderIndex: number }[]
}

/** Một dòng Part trên màn cấu trúc (vd. PART 1 — 6 câu) */
export interface PartStructureItem {
    part: string          // "Part1" … "Part7"
    name: string          // "PART 1"
    questionCount: number
}
/**
 * GET /api/test/{id}/structure
 * Mục đích: màn chọn full / từng Part trước khi Bắt đầu.
 */
export interface TestStructure {
    testId: string
    title: string
    series: string
    durationMinutes: number
    parts: PartStructureItem[]
    totalQuestions: number
}
/**
 * Directions intro 1 Part — ảnh (+ audio Listening).
 * Text nằm trong ảnh; không có field text riêng.
 */
export interface PlayPartDirections {
    part: string
    imageUrl: string
    audioUrl: string | null   // Part 5–7 = null
}
/** Đáp án A/B/C/D lúc thi — không có isCorrect (che đáp án) */
export interface PlayOption {
    id: string
    label: string
    content: string
}
/**
 * Một câu trong gói play.
 * Part 3–4: 3 câu liên tiếp thường cùng audioUrl → UI nhóm 3 câu / 1 băng.
 */
export interface PlayQuestion {
    questionId: string
    orderIndex: number
    part: string
    content: string
    audioUrl: string | null
    imageUrl: string | null
    passage: string | null
    options: PlayOption[]
}
/**
 * GET /api/test/{id}/play?parts=1,2
 * Mục đích: gói Directions + câu để làm bài (chưa nộp — Day 28).
 */
export interface TestPlay {
    testId: string
    title: string
    series: string
    durationMinutes: number
    directions: PlayPartDirections[]
    questions: PlayQuestion[]
}
