/** Khớp response của AdminController + AdminUsersController. */
import type {
    TestSessionHistoryResponse, TestStatsOverviewResponse,
    TestStatsPartsResponse, TestStatsTimelineResponse,
} from '@/types/test-session.types'

/** GET /api/admin/overview */
export interface AdminOverview {
    users: { total: number; new7Days: number }
    content: {
        totalTests: number
        publishedTests: number
        draftTests: number
        totalQuestions: number
        totalVocabularies: number
        totalSchedules: number
        /** Kỳ thi còn hiệu lực và chưa diễn ra — số đáng quan tâm hơn tổng */
        upcomingSchedules: number
    }
    exams: { totalSessions: number; sessions7Days: number; averageScore: number }
    topTests: { testId: string; title: string; attempts: number }[]
}

/** GET /api/admin/stats?days=30 */
export interface AdminStats {
    days: number
    /** Một dòng mỗi ngày, đã điền đủ cả ngày không có dữ liệu */
    daily: { date: string; newUsers: number; sessions: number }[]
    /** Phân bố điểm theo dải 100 */
    scoreBands: { label: string; count: number }[]
    roles: { role: string; count: number }[]
}

/** Một dòng trong bảng quản lý tài khoản */
export interface AdminUser {
    id: string
    email: string
    fullName: string
    avatarUrl: string | null
    roles: string[]
    emailConfirmed: boolean
    isLockedOut: boolean
    lockoutEnd: string | null
    accessFailedCount: number
    plan: string
    targetScore: number
    xpPoints: number
    streakDays: number
    createdAt: string
    completedSessions: number
    bestScore: number | null
}

export interface PagedResult<T> {
    items: T[]
    total: number
    page: number
    pageSize: number
}

export interface AdminUserQuery {
    search?: string
    role?: string
    lockedOnly?: boolean
    page?: number
    pageSize?: number
}

/**
 * GET /api/admin/users/{id} — chi tiết một tài khoản.
 *
 * Các khối thống kê có thể null: backend trả null khi service báo lỗi (VD tài khoản
 * chưa thi lần nào) để FE ẩn đúng khối đó, thay vì cả trang vỡ.
 */
export interface AdminUserDetail {
    profile: {
        id: string
        email: string
        fullName: string
        avatarUrl: string | null
        roles: string[]
        emailConfirmed: boolean
        isLockedOut: boolean
        lockoutEnd: string | null
        accessFailedCount: number
        plan: string
        targetScore: number
        examDate: string | null
        xpPoints: number
        streakDays: number
        lastStudyDate: string | null
        createdAt: string
    }
    overview: TestStatsOverviewResponse | null
    parts: TestStatsPartsResponse | null
    timeline: TestStatsTimelineResponse | null
    history: TestSessionHistoryResponse | null
}

export interface CreateUserRequest {
    email: string
    fullName: string
    roles: string[]
}
