/**
 * Types cho API TestSession (Day 28) — khớp DTO backend.
 *
 * Luồng:
 *   start → sessionId
 *   saveAnswers → lưu tạm trên server
 *   submit → điểm + review
 */

/** Trạng thái phiên thi — backend serialize enum dạng string. */
export type TestSessionStatus = 'InProgress' | 'Completed' | 'Abandoned'

/** Body POST /api/test-session/start */
export interface StartTestSessionPayload {
    testId: string
    /** Part muốn làm: [1,2,5] — bỏ trống = full đề */
    parts?: number[]
}

/** Response sau khi start thành công */
export interface TestSessionStarted {
    sessionId: string
    testId: string
    testTitle: string
    status: TestSessionStatus
    startedAt: string
    partsFilter: number[] | null
    questionCount: number
}

/** Một đáp án user chọn — selectedOptionId null = bỏ qua */
export interface SessionAnswerItem {
    questionId: string
    selectedOptionId: string | null
}

/** Body PATCH /api/test-session/{id}/answers */
export interface SaveSessionAnswersPayload {
    answers: SessionAnswerItem[]
}

/** Response PATCH answers — số dòng đã lưu */
export interface SaveSessionAnswersResult {
    saved: number
}

/** Chi tiết 1 câu sau khi nộp bài */
export interface SessionAnswerReview {
    questionId: string
    orderIndex: number
    part: string
    selectedOptionId: string | null
    correctOptionId: string
    correctLabel: string
    isCorrect: boolean
    explanation: string | null
}

/** Thống kê đúng/sai theo Part — Day 30 Phần 2 */
export interface PartBreakdownItem {
    part: number
    correct: number
    total: number
    skipped: number
    accuracyPercent: number
}

/** Response POST /api/test-session/{id}/submit */
export interface TestSessionSubmitResult {
    sessionId: string
    correctCount: number
    totalCount: number
    skippedCount: number
    listeningScore: number | null
    readingScore: number | null
    totalScore: number | null
    completedAt: string
    partBreakdown: PartBreakdownItem[]
    reviews: SessionAnswerReview[]
}
