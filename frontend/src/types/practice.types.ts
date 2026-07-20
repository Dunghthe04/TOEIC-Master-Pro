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