/**
 * Gọi API /api/test-session — phiên thi Day 28.
 *
 * Cần JWT (axios interceptor tự gắn Bearer token).
 *
 * Luồng MockTestPlayPage (Bước 5):
 *   1. start(testId, parts)     → lưu sessionId vào state
 *   2. saveAnswers(sessionId,…) → thay localStorage
 *   3. submit(sessionId)        → màn kết quả
 */
import api from '@/api/axios'
import type {
    StartTestSessionPayload,
    TestSessionStarted,
    SessionAnswerItem,
    SaveSessionAnswersResult,
    TestSessionSubmitResult,
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
}
