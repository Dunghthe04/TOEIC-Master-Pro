import api from '@/api/axios'
import type { QuestionResponse, CreateQuestionRequest, UpdateQuestionRequest } from '@/types/question.types'

export const QuestionService = {
    getList: (param?: { part?: number; difficulty?: string; tag?: string }) =>
        api.get<QuestionResponse[]>('/question', { params: param }).then(q => q.data),

    getById: (id: string) =>
        api.get<QuestionResponse>(`/question/${id}`).then(q => q.data),

    create: (payload: CreateQuestionRequest) =>
        api.post<{ id: string }>('/question', payload).then(r => r.data),

    update: (id: string, payload: UpdateQuestionRequest) =>
        api.put(`/question/${id}`, payload).then(r => r.data),

    delete: (id: string) =>
        api.delete(`/question/${id}`).then(r => r.data),


}