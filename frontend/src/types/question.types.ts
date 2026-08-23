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
/**
 * Báo cáo của lần chạy thử import (`?dryRun=true`).
 *
 * MỤC ĐÍCH: import 200 câu là việc khó hoàn tác. Server đọc gói, kiểm hết, rồi DỪNG —
 * không tạo câu, không gán vào đề, không giải nén media. Báo cáo này là thứ duy nhất
 * nó trả về, và người dùng xem nó TRƯỚC khi bấm import thật.
 */
export interface TestImportDryRunReport {
    dryRun: true
    /** false khi gói có lỗi chặn (dòng lỗi, OrderIndex trùng, media thiếu). */
    ok: boolean
    summary: string

    manifest: {
        series: string | null
        title: string | null
        sections: string[]
        source: string | null
    } | null

    rows: { total: number; valid: number; invalid: number }
    errors: ImportRowError[]

    /** Suy ra từ OrderIndex, không tin theo manifest. */
    sections: string[]

    orderIndex: {
        min: number | null
        max: number | null
        /** Trùng = một dòng bị đè im lặng khi import thật. */
        duplicates: number[]
        missing: number[]
    }

    media: {
        /** false khi upload .xlsx trần — không có gói để đối chiếu. */
        checked: boolean
        note: string | null
        audioReferenced: number
        /** Excel trỏ tới mà gói không có → câu sẽ mất tiếng. */
        audioMissing: string[]
        imageReferenced: number
        imageMissing: string[]
        /** Có trong gói mà không câu nào dùng — thường là dấu hiệu sai tên. */
        unusedInPackage: string[]
    }

    /** Vị trí đang có câu trong đề và SẼ BỊ THAY. Đây là "import này phá mất cái gì". */
    willReplace: number[]
}
