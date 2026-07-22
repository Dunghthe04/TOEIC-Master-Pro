//Gọi API /api/test — danh sách, tạo mới, xóa.
import api from "@/api/axios";
import type {
    TestSummary,
    CreateTestPayload,
    UpdateTestPayload,
    TestStructure,
    TestPlay,
    TestDetail,
    AddQuestionsPayload,
} from "@/types/test.types";

export const TestService = {
    /** Danh sách đề (CM). */
    getList: (isPublished?: boolean) =>
        api.get<TestSummary[]>('/test', {
            params: isPublished !== undefined ? { isPublished } : undefined,
        }).then(r => r.data),

    /** Chi tiết đề + câu đã gán (CM). */
    getById: (id: string) =>
        api.get<TestDetail>(`/test/${id}`).then(r => r.data),

    create: (payload: CreateTestPayload) =>
        api.post<{ id: string }>('/test', payload).then(r => r.data),

    update: (id: string, payload: UpdateTestPayload) =>
        api.put(`/test/${id}`, payload).then(r => r.data),

    delete: (id: string) =>
        api.delete(`/test/${id}`).then(r => r.data),

    /**
     * Gán thêm câu vào đề (CM).
     * Body: { items: [{ questionId, orderIndex }] }
     */
    addQuestions: (id: string, payload: AddQuestionsPayload) =>
        api.post(`/test/${id}/questions`, payload).then(r => r.data),

    /** Gỡ 1 câu khỏi đề (CM). */
    removeQuestion: (testId: string, questionId: string) =>
        api.delete(`/test/${testId}/questions/${questionId}`).then(r => r.data),

    /** List đề published (User thi thử). */
    getPublished: (series?: string) =>
        api.get<TestSummary[]>('/test/published', {
            params: series ? { series } : undefined,
        }).then(r => r.data),

    getStructure: (id: string) =>
        api.get<TestStructure>(`/test/${id}/structure`).then(r => r.data),

    getPlay: (id: string, parts?: number[]) =>
        api.get<TestPlay>(`/test/${id}/play`, {
            params: parts?.length
                ? { parts: parts.join(',') }
                : undefined,
        }).then(r => r.data),
}