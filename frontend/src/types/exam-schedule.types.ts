// Khớp ExamScheduleResponse từ backend Day 19
export interface ExamSchedule {
    id: string
    title: string
    organizer: string
    location: string
    city: string
    examDate: string            // ISO: "2026-08-15T00:00:00"
    startTime: string           // "08:30:00"
    registrationDeadline: string
    fee: number
    availableSlots: number | null
    registerUrl: string | null
    isActive: boolean
    createdAt: string
}

// Tham số query GET /api/examschedule
export interface ExamScheduleFilter {
    city?: string
    month?: number
    year?: number
    isActive?: boolean
}