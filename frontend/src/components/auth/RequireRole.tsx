/**
 * Chặn route theo role — bọc /cm/* và /admin/*.
 *
 * ⚠️ Đây CHỈ LÀ UX (đá về đúng trang chủ khi gõ URL sai vai). Bảo mật thật nằm ở
 * [Authorize(Roles=...)] phía server (Day 35) — frontend chạy trên máy người dùng,
 * họ sửa được tất cả nên không thể tin route guard này là lớp bảo vệ duy nhất.
 *
 * Không dùng <Navigate to="/dashboard" /> cứng: User gõ /admin thì phải về /dashboard,
 * nhưng CM gõ /admin phải về /cm — mỗi vai về ĐÚNG trang chủ của mình, không phải
 * luôn luôn /dashboard.
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { hasRole, homeFor, type Role } from '@/lib/roles'

export default function RequireRole({ allow }: { allow: Role[] }) {
    const { user } = useAuthStore()
    const allowed = allow.some(role => hasRole(user, role))

    if (!allowed) return <Navigate to={homeFor(user)} replace />
    return <Outlet />
}
