// Backend serialize enum dạng tên: "Part1", "Easy"...
export type QuestionPart =
    | 'Part1' | 'Part2' | 'Part3' | 'Part4'
    | 'Part5' | 'Part6' | 'Part7'


export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard'


// Option lúc luyện — không có isCorrect
export interface PracticeOption {
    id: string
    label: string
    content: string
}

export interface PracticeQuestion {
    id: string
    part: QuestionPart
    difficulty: DifficultyLevel
    content: string
    audioUrl: string | null
    imageUrl: string | null
    passage: string | null
    tags: string[]
    options: PracticeOption[]
}

/**
 * GET /practice/questions — câu hỏi kèm sessionId.
 *
 * sessionId phải gửi lại khi nộp: nó chứng minh những câu này đã thật sự được
 * server phát cho chính user đang gọi. Trước đây submit chấm bất kỳ questionId
 * nào, nên lấy id từ màn thi thật rồi gửi sang là nhận thẳng đáp án đúng.
 *
 * null = không có câu nào khớp bộ lọc, nên không có phiên nào được tạo.
 */
export interface PracticeStart {
    sessionId: string | null
    questions: PracticeQuestion[]
}

export interface PracticeFilter {
    part?: number          // query: 1–4 (Day 26)
    difficulty?: DifficultyLevel
    tag?: string
    limit?: number
}

export interface PracticeAnswerItem {
    questionId: string
    selectedOptionId: string | null
}
export interface PracticeAnswerReview {
    questionId: string
    selectedOptionId: string | null
    correctOptionId: string
    correctLabel: string
    isCorrect: boolean
    explanation: string
}
export interface PracticeResult {
    totalCount: number
    correctCount: number
    skippedCount: number
    scorePercent: number
    reviews: PracticeAnswerReview[]
}