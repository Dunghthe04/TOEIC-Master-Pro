import api from '@/api/axios'
import type {
    AnswerReviewResponse,
    ReviewNotebookResponse,
} from '@/types/review.types'

/** Sổ tay lỗi sai — /api/review/* */
export const ReviewService = {
    /**
     * Danh sách câu chưa gỡ.
     *
     * `part` và `testId` bỏ trống = tất cả. Backend luôn trả `total`, `byPart` và
     * `byTest` của TOÀN BỘ sổ tay, không phụ thuộc bộ lọc — nhờ vậy cả hai thanh lọc dựng
     * được từ một lượt gọi, và lọc sang một Part/một đề rồi vẫn quay lại được chỗ khác.
     *
     * `matched` thì NGƯỢC LẠI: đó là số câu khớp bộ lọc hiện tại.
     */
    getQuestions: (params?: {
        part?: number
        testId?: string
        skip?: number
        take?: number
    }) =>
        api
            .get<ReviewNotebookResponse>('/review/questions', {
                params: {
                    part: params?.part,
                    testId: params?.testId,
                    skip: params?.skip ?? 0,
                    take: params?.take ?? 20,
                },
            })
            .then((r) => r.data),

    /** Trả lời một câu trong chế độ luyện lại. */
    answer: (questionId: string, selectedOptionId: string) =>
        api
            .post<AnswerReviewResponse>(`/review/questions/${questionId}/answer`, {
                selectedOptionId,
            })
            .then((r) => r.data),

    /** Tự đánh dấu "Đã hiểu" — gỡ ngay. Trả về số câu còn lại. */
    resolve: (questionId: string) =>
        api
            .post<number>(`/review/questions/${questionId}/resolve`)
            .then((r) => r.data),
}
