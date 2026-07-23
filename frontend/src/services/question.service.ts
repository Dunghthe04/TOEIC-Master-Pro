import api from '@/api/axios'
import type {
    QuestionResponse,
    CreateQuestionRequest,
    UpdateQuestionRequest,
    ImportResultResponse,
} from '@/types/question.types'

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

      // Upload Excel — multipart/form-data, field name phải là "file"
    import: (file: File) => {
        const form = new FormData()
        form.append('file', file)
        return api
            .post<ImportResultResponse>('/question/import', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then(r => r.data)
    },

    /** Tải file Excel mẫu (cột AudioFile, ImageFile, OrderIndex). */
    downloadImportTemplate: () =>
        api.get('/question/import-template', { responseType: 'blob' }).then(r => r.data as Blob),
}