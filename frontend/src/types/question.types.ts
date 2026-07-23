// Định nghĩa TypeScript types khớp với QuestionResponse từ backend.
export type QuestionPart = number
export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard'

export interface OptionResponse {
    id: string
    label: string
    content: string
    isCorrect: boolean
}

export interface QuestionResponse {
    id: string
    part: QuestionPart
    difficulty: DifficultyLevel
    content: string
    explanation: string
    audioUrl: string | null
    imageUrl: string | null
    passage: string | null
    tags: string[]
    isPublished: boolean
    options: OptionResponse[]
}

export interface CreateOptionRequest {
    label: string
    content: string
    isCorrect: boolean
}

export interface CreateQuestionRequest {
    part: QuestionPart
    difficulty: DifficultyLevel
    content: string
    explanation: string
    audioUrl?: string
    imageUrl?: string
    passage?: string
    tags: string[]
    isPublished: boolean
    options: CreateOptionRequest[]
}

//update có cấu trúc y hệt create, nên k cần viết lại
export type UpdateQuestionRequest = CreateQuestionRequest

export interface ImportRowError {
    row: number
    reason: string
}
export interface ImportResultResponse {
    totalRows: number
    successCount: number
    failedCount: number
    errors: ImportRowError[]
    created?: { questionId: string; orderIndex: number | null }[]
}

export interface TestListeningImportResult {
    import: ImportResultResponse
    assignedToTest: number
}