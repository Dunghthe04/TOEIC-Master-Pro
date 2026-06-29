// Định nghĩa TypeScript types khớp với TestSummaryResponse từ backend.
export interface TestSummary {
    id: string
    title: string
    description: string | null
    durationMinutes: number
    isPublished: boolean
    questionCount: number
    createdByUserId: string
    createdAt: string
}

export interface CreateTestPayload {
    title: string
    description?: string
    durationMinutes: number
    isPublished: boolean
}

export interface UpdateTestPayload {
    title: string
    description?: string
    durationMinutes: number
    isPublished: boolean
}
