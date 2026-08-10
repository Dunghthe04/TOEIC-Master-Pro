/**
 * Gọi API /api/test-session — phiên thi Day 28–32.
 *
 * Cần JWT (axios interceptor tự gắn Bearer token).
 */
import api from '@/api/axios'
import type {
    StartTestSessionPayload,
    TestSessionStarted,
    SessionAnswerItem,
    SaveSessionAnswersResult,
    TestSessionSubmitResult,
    TestSessionHistoryParams,
    TestSessionHistoryResponse,
    TestSessionDetailResponse,
    TestScoreStatsResponse,
    TestSessionStatsParams,
    TestStatsOverviewResponse,
    TestStatsTimelineResponse,
    TestStatsPartsResponse,
} from '@/types/test-session.types'

export const TestSessionService = {
    /**
     * Bắt đầu phiên thi — gọi khi user bấm "Bắt đầu" trên màn cấu trúc đề.
     * Trả sessionId dùng cho mọi request sau.
     */
    start: (payload: StartTestSessionPayload) =>
        api
            .post<TestSessionStarted>('/test-session/start', payload)
            .then((r) => r.data),

    markReadingStarted: (sessionId: string) =>
        api
            .post<{ readingSecondsLeft: number | null }>(
                `/test-session/${sessionId}/reading-start`,
            )
            .then((r) => r.data),

    /**
     * Lưu đáp án tạm (upsert trên server).
     * Gọi khi user chọn đáp án — có thể debounce 300–500ms để giảm request.
     */
    saveAnswers: (sessionId: string, answers: SessionAnswerItem[]) =>
        api
            .patch<SaveSessionAnswersResult>(`/test-session/${sessionId}/answers`, {
                answers,
            })
            .then((r) => r.data),

    /**
     * Nộp bài — chấm điểm, không sửa đáp án được nữa.
     */
    submit: (sessionId: string) =>
        api
            .post<TestSessionSubmitResult>(`/test-session/${sessionId}/submit`)
            .then((r) => r.data),

    /** Danh sách lần thi đã nộp — Day 31 Bước 1 */
    getHistory: (params?: TestSessionHistoryParams) =>
        api
            .get<TestSessionHistoryResponse>('/test-session/history', { params })
            .then((r) => r.data),

    /** Xem lại 1 lần thi — Day 31 Bước 2 */
    getDetail: (sessionId: string) =>
        api
            .get<TestSessionDetailResponse>(`/test-session/${sessionId}`)
            .then((r) => r.data),

    /** Best score / đề cho biểu đồ — Day 31 Bước 3 */
    getScoreStatsByTest: (fullOnly = true) =>
        api
            .get<TestScoreStatsResponse>('/test-session/stats/by-test', {
                params: { fullOnly },
            })
            .then((r) => r.data),

    /** Tổng quan dashboard — Day 32 Bước 1 */
    getStatsOverview: (params?: TestSessionStatsParams) =>
        api
            .get<TestStatsOverviewResponse>('/test-session/stats/overview', {
                params: { fullOnly: params?.fullOnly ?? true },
            })
            .then((r) => r.data),

    /** Điểm theo thời gian — line chart dashboard — Day 32 Bước 2 */
    getStatsTimeline: (params?: TestSessionStatsParams) =>
        api
            .get<TestStatsTimelineResponse>('/test-session/stats/timeline', {
                params: { fullOnly: params?.fullOnly ?? true },
            })
            .then((r) => r.data),

    /** Gom Part yếu từ nhiều phiên — Day 32 Bước 3 */
    getStatsParts: (params?: TestSessionStatsParams) =>
        api
            .get<TestStatsPartsResponse>('/test-session/stats/parts', {
                params: { fullOnly: params?.fullOnly ?? true },
            })
            .then((r) => r.data),
}
