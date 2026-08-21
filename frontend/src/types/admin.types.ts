/** Khớp response của AdminController + AdminUsersController. */

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

export interface CreateUserRequest {
    email: string
    fullName: string
    roles: string[]
}
