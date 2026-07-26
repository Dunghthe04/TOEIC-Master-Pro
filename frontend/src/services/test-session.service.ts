/**
 * Gọi API /api/test-session — phiên thi Day 28–31.
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
    DashboardSummaryResponse,
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

    /**
     * Tổng hợp trang chủ — Day 32.
     * 1 request duy nhất trả cả xu hướng điểm lẫn accuracy theo Part.
     */
    getDashboard: (recentLimit = 10) =>
        api
            .get<DashboardSummaryResponse>('/test-session/dashboard', {
                params: { recentLimit },
            })
            .then((r) => r.data),
}
