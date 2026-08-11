import api from '@/api/axios'
import type {
    PracticeFilter,
    PracticeStart,
    PracticeAnswerItem,
    PracticeResult,
} from '@/types/practice.types'

export const PracticeService = {
    /**
     * Lấy câu luyện tập. Trả { sessionId, questions } — KHÔNG còn là mảng trần.
     * Phải giữ sessionId để gửi kèm lúc nộp.
     */
    getQuestions: (filter?: PracticeFilter) =>
        api
            .get<PracticeStart>('/practice/questions', { params: filter })
            .then(r => r.data),

    /**
     * Nộp bài luyện. sessionId BẮT BUỘC — server chỉ chấm câu thuộc phiên đó.
     * Thiếu nó thì server trả "Không tìm thấy phiên luyện tập."
     */
    submit: (sessionId: string, answers: PracticeAnswerItem[]) =>
        api
            .post<PracticeResult>('/practice/submit', { sessionId, answers })
            .then(r => r.data),
}
