import api from '@/api/axios'
import type {
    PracticeFilter,
    PracticeQuestion,
    PracticeAnswerItem,
    PracticeResult,
} from '@/types/practice.types'

export const PracticeService = {
    getQuestions: (filter?: PracticeFilter) =>
        api
            .get<PracticeQuestion[]>('/practice/questions', { params: filter })
            .then(r => r.data),
    // tên phải là submit — khớp PracticePage
    // body phải bọc { answers } — khớp SubmitPracticeRequest
    submit: (answers: PracticeAnswerItem[]) =>
        api
            .post<PracticeResult>('/practice/submit', { answers })
            .then(r => r.data),
}