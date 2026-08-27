/**
 * Sổ tay lỗi sai — /api/review/*
 *
 * Thay cho `practice.types.ts`. Khác biệt không nằm ở kiểu dữ liệu mà ở CHỦ THỂ: kiểu cũ
 * mô tả "một bộ câu hỏi lấy từ kho theo bộ lọc", kiểu này mô tả "những câu CHÍNH BẠN đã
 * làm sai".
 */

export interface ReviewOption {
    id: string
    /** A / B / C / D */
    label: string
    content: string
}

export interface ReviewQuestionItem {
    questionId: string

    /** Đề chứa câu này. Null khi câu không còn thuộc đề nào. */
    testId: string | null
    /** Tên đề — hiện trên đầu nhóm. */
    testTitle: string | null
    /**
     * Số câu TRONG ĐỀ (1–200).
     *
     * Thứ duy nhất người học nhớ được về một câu. Họ không nhớ nội dung — mấy bài đọc
     * Part 7 nhìn na ná nhau — nhưng nhớ "câu 147 phân vân mãi".
     */
    questionNumber: number | null
    /**
     * 🔴 CHUỖI, không phải số: backend trả enum `QuestionPart` và System.Text.Json
     * serialize enum thành TÊN — "Part5", "Part7". Viết `Part {item.part}` là ra
     * "Part Part7".
     *
     * Dùng `partToNumber()` để đổi sang số. Cùng cách mọi màn thi đang làm.
     */
    part: string
    content: string
    audioUrl: string | null
    imageUrl: string | null
    passage: string | null
    options: ReviewOption[]

    /**
     * 🔴 CÓ đáp án đúng, khác payload lúc đang thi.
     *
     * Lúc thi mà lộ đáp án qua DevTools là hỏng cả bài. Ở đây người học đã làm xong, đã
     * sai, và mục đích của màn này là HIỂU vì sao — giấu đáp án là giấu đúng thứ họ cần.
     */
    correctOptionId: string

    explanation: string | null
    transcript: string | null

    /** Đã sai câu này bao nhiêu lần — câu sai đi sai lại là điểm yếu dai dẳng. */
    wrongCount: number
    /** Đang đúng liên tiếp mấy lần. Hiện dạng "1/2" để thấy mình sắp gỡ được câu. */
    correctStreak: number
    lastWrongAt: string
}

export interface ReviewPartCount {
    part: number
    count: number
}

/** Một đề có mặt trong sổ tay. Đề vừa thi gần nhất đứng đầu danh sách. */
export interface ReviewTestCount {
    testId: string
    title: string
    count: number
}

export interface ReviewNotebookResponse {
    /** Tổng số câu chưa gỡ — KHÔNG phụ thuộc bộ lọc đang chọn. */
    total: number
    /** Số câu theo từng Part, cũng không phụ thuộc bộ lọc. */
    byPart: ReviewPartCount[]
    /** Số câu theo từng đề, đề mới thi nhất trước. Cũng không phụ thuộc bộ lọc. */
    byTest: ReviewTestCount[]
    /**
     * Số câu KHỚP bộ lọc đang chọn.
     *
     * Khác `total`: đang lọc Part 7 thì total vẫn là 28 (để chip "Tất cả"
     * hiện đúng), còn matched là 10 — nhờ matched mà dòng "đang hiện 20 trong N" không
     * nói sai khi có bộ lọc.
     */
    matched: number
    /** Câu của trang hiện tại, ĐÃ xếp theo đề rồi theo số câu. */
    items: ReviewQuestionItem[]
}

/** Kết quả sau khi trả lời một câu trong sổ tay. */
export interface AnswerReviewResponse {
    isCorrect: boolean
    /** Đáp án đúng — để tô ngay, không phải gọi lại. */
    correctOptionId: string
    correctStreak: number
    /** Câu đã rời sổ tay chưa. */
    resolved: boolean
    /** Còn lại bao nhiêu câu chưa gỡ — cập nhật số đếm tại chỗ. */
    remainingTotal: number
}
