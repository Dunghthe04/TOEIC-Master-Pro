/**
 * Types cho API TestSession (Day 28–32) — khớp DTO backend.
 *
 * Luồng thi:
 *   start → sessionId → saveAnswers → submit
 * Lịch sử (Day 31):
 *   getHistory → getDetail / getScoreStatsByTest
 * Dashboard (Day 32):
 *   getStatsOverview / getStatsTimeline / getStatsParts
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
        /** true = phiên đang làm dở được trả lại, không phải phiên mới tạo */
    resumed: boolean
    /** Đáp án đã lưu trên server — rỗng nếu là phiên mới */
    answers: SessionAnswerItem[]
    /** null = chưa từng vào Reading */
    readingStartedAt: string | null
    /** Giây Reading còn lại DO SERVER TÍNH — null = chưa vào Reading */
    readingSecondsLeft: number | null
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

// ── Day 31: Lịch sử thi ───────────────────────────────────────────────────

/** Một lần thi đã nộp — GET /history */
export interface TestSessionHistoryItem {
    sessionId: string
    testId: string
    testTitle: string
    testSeries: string
    startedAt: string
    completedAt: string
    partsFilter: number[] | null
    listeningScore: number | null
    readingScore: number | null
    totalScore: number | null
    correctCount: number
    totalCount: number
}

/** Response GET /api/test-session/history */
export interface TestSessionHistoryResponse {
    items: TestSessionHistoryItem[]
    total: number
    page: number
    pageSize: number
}

/** Query GET /history */
export interface TestSessionHistoryParams {
    testId?: string
    page?: number
    pageSize?: number
}

/** Chi tiết 1 phiên đã nộp — GET /api/test-session/{id} */
export interface TestSessionDetailResponse {
    sessionId: string
    testId: string
    testTitle: string
    testSeries: string
    status: TestSessionStatus
    startedAt: string
    completedAt: string
    partsFilter: number[] | null
    correctCount: number
    totalCount: number
    skippedCount: number
    listeningScore: number | null
    readingScore: number | null
    totalScore: number | null
    partBreakdown: PartBreakdownItem[]
    reviews: SessionAnswerReview[]
}

/** Best score theo đề — GET /stats/by-test (1 cột biểu đồ) */
export interface TestScoreByTestItem {
    testId: string
    testTitle: string
    testSeries: string
    attemptCount: number
    bestTotalScore: number | null
    bestListeningScore: number | null
    bestReadingScore: number | null
    bestSessionId: string | null
    lastCompletedAt: string | null
}

/** Response GET /api/test-session/stats/by-test */
export interface TestScoreStatsResponse {
    targetScore: number
    items: TestScoreByTestItem[]
}

// ── Day 32: Dashboard stats ─────────────────────────────────────────────────

/** Query chung cho các API stats — fullOnly mặc định true trên backend */
export interface TestSessionStatsParams {
    fullOnly?: boolean
}

/** Response GET /api/test-session/stats/overview — card tổng quan dashboard */
export interface TestStatsOverviewResponse {
    targetScore: number
    totalAttempts: number
    distinctTests: number
    bestTotalScore: number | null
    bestSessionId: string | null
    latestTotalScore: number | null
    latestSessionId: string | null
    averageTotalScore: number | null
    lastCompletedAt: string | null
}

/** Một điểm trên line chart — GET /stats/timeline */
export interface TestStatsTimelineItem {
    sessionId: string
    testId: string
    testTitle: string
    testSeries: string
    completedAt: string
    partsFilter: number[] | null
    listeningScore: number | null
    readingScore: number | null
    totalScore: number | null
}

/** Response GET /api/test-session/stats/timeline */
export interface TestStatsTimelineResponse {
    targetScore: number
    items: TestStatsTimelineItem[]
}

/** Response GET /api/test-session/stats/parts — gom Part yếu nhiều phiên */
export interface TestStatsPartsResponse {
    sessionsAnalyzed: number
    parts: PartBreakdownItem[]
    weakestParts: number[]
}

/** Chuyển detail → format màn kết quả (tái dùng ExamResultScreen). */
export function sessionDetailToSubmitResult(
    detail: TestSessionDetailResponse
): TestSessionSubmitResult {
    return {
        sessionId: detail.sessionId,
        correctCount: detail.correctCount,
        totalCount: detail.totalCount,
        skippedCount: detail.skippedCount,
        listeningScore: detail.listeningScore,
        readingScore: detail.readingScore,
        totalScore: detail.totalScore,
        completedAt: detail.completedAt,
        partBreakdown: detail.partBreakdown,
        reviews: detail.reviews,
    }
}
/** GET /api/test-session/active — bài đang làm dở (204 = không có) */
export interface ActiveTestSession {
    sessionId: string
    testId: string
    testTitle: string
    startedAt: string
    /** Phạm vi của BÀI CŨ — null = full đề */
    partsFilter: number[] | null
    answeredCount: number
    questionCount: number
    readingSecondsLeft: number | null
}
