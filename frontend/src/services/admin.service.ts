import api from '@/api/axios'
import type {
    AdminActiveSessionsResponse, AdminOverview, AdminStats, AdminUser,
    AdminUserDetail, AdminUserQuery, AuditCategory, AuditLogItem, AuditLogQuery,
    CreateUserRequest, PagedResult,
} from '@/types/admin.types'

export const AdminService = {
    getOverview: () => api.get<AdminOverview>('/admin/overview').then(r => r.data),

    /** Số liệu biểu đồ. days bị backend kẹp trong [7, 180]. */
    getStats: (days = 30) =>
        api.get<AdminStats>('/admin/stats', { params: { days } }).then(r => r.data),

    /**
     * Danh sách tài khoản — phân trang phía SERVER.
     * Truyền params qua axios `params` để nó tự url-encode: search "a+b" hay "100%"
     * ghép tay vào query string sẽ bị hiểu sai.
     */
    getUsers: (q: AdminUserQuery = {}) =>
        api.get<PagedResult<AdminUser>>('/admin/users', {
            params: {
                search: q.search || undefined,
                role: q.role || undefined,
                // undefined thì axios bỏ hẳn param; gửi false sẽ thành "?lockedOnly=false"
                // — vô hại nhưng làm URL rối khi debug.
                lockedOnly: q.lockedOnly ? true : undefined,
                page: q.page ?? 1,
                pageSize: q.pageSize ?? 20,
            },
        }).then(r => r.data),

    /**
     * Phiên thi đang diễn ra. staleHours = ngưỡng coi là "treo" (backend kẹp 1–72).
     * Đọc trực tiếp từ TestSessions Status=InProgress, không phải bảng log.
     */
    getActiveSessions: (staleHours = 4) =>
        api.get<AdminActiveSessionsResponse>('/admin/active-sessions', {
            params: { staleHours },
        }).then(r => r.data),

    /** Chi tiết 1 tài khoản: thông tin + thống kê thi + lịch sử thi */
    getUserDetail: (id: string) =>
        api.get<AdminUserDetail>(`/admin/users/${id}`).then(r => r.data),

    createUser: (data: CreateUserRequest) =>
        api.post<{ id: string; message: string }>('/admin/users', data).then(r => r.data),

    updateRoles: (id: string, roles: string[]) =>
        api.put<{ message: string }>(`/admin/users/${id}/roles`, { roles }).then(r => r.data),

    /** lock=false để mở khoá. days=null (hoặc bỏ) = khoá vô thời hạn. */
    setLock: (id: string, lock: boolean, days?: number | null) =>
        api.put<{ message: string }>(`/admin/users/${id}/lock`, {
            lock,
            days: days ?? null,
        }).then(r => r.data),

    sendPasswordReset: (id: string) =>
        api.post<{ message: string }>(`/admin/users/${id}/send-password-reset`)
            .then(r => r.data),

    confirmEmail: (id: string) =>
        api.post<{ message: string }>(`/admin/users/${id}/confirm-email`).then(r => r.data),

    /**
     * Nhật ký hành động — phân trang phía SERVER.
     *
     * from/to phải là ISO UTC. Backend so sánh trên trục UTC vì AuditLog.CreatedAt lưu
     * UtcNow; việc quy đổi từ ngày địa phương do FE làm vì chỉ trình duyệt biết múi giờ
     * của người đang xem.
     */
    getAuditLogs: (q: AuditLogQuery = {}) =>
        api.get<PagedResult<AuditLogItem>>('/admin/audit-logs', {
            params: {
                category: q.category || undefined,
                action: q.action || undefined,
                actorEmail: q.actorEmail || undefined,
                targetId: q.targetId || undefined,
                from: q.from || undefined,
                to: q.to || undefined,
                page: q.page ?? 1,
                pageSize: q.pageSize ?? 50,
            },
        }).then(r => r.data),

    /** Các loại hành động ĐANG CÓ trong log (distinct từ DB) — nguồn cho dropdown lọc. */
    getAuditActions: (category?: AuditCategory) =>
        api.get<string[]>('/admin/audit-logs/actions', {
            params: { category: category || undefined },
        }).then(r => r.data),
}
