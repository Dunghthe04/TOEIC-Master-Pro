//Gọi API /api/test — danh sách, tạo mới, xóa.
import api from "@/api/axios";
import type { TestSummary, CreateTestPayload, UpdateTestPayload } from "@/types/test.types";

export const TestService = {
    //Lấy danh sách test dạng tóm tắt
    getList: (isPublished?: boolean) =>
        api.get<TestSummary[]>('/test', { params: isPublished !== undefined ? isPublished : undefined })
            .then(r => r.data),

    create: (payload: CreateTestPayload) =>
        api.post<{ id: string }>('/test', payload).then(r => r.data),

    update: (id: string, payload: UpdateTestPayload) =>
        api.put(`/test/${id}`, payload).then(r => r.data),

    delete: (id: string) =>
        api.delete(`/test/${id}`).then(r => r.data)
}