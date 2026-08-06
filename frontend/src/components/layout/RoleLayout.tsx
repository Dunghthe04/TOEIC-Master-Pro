/**
 * Chọn layout theo vai — không thể viết if/else trong route tree của React Router,
 * nên cần một component trung gian làm việc đó.
 *
 *   User        → UserLayout  (header ngang, hướng sản phẩm)
 *   CM / Admin  → MainLayout  (sidebar dọc, hướng công cụ)
 *
 * ⚠️ Đây chỉ là UX. Chặn quyền thật nằm ở RequireRole (bước 5) và
 * [Authorize(Roles=...)] phía server (Day 35).
 */
import { useAuthStore } from '@/store/auth.store'
import { usesTopNav } from '@/lib/roles'
import UserLayout from './UserLayout'
import MainLayout from './MainLayout'

export default function RoleLayout() {
    const { user } = useAuthStore()
    return usesTopNav(user) ? <UserLayout /> : <MainLayout />
}
