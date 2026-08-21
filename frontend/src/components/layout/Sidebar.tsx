//Thanh điều hướng bên trái — hiển thị các mục menu chính của app.
//Dùng NavLink thay vì Link vì NavLink tự nhận biết route đang active để highlight menu đang chọn.

import { NavLink } from "react-router-dom";
import { useAuthStore } from '@/store/auth.store'
import { navFor } from '@/lib/roles'

/**
 * Sidebar cho CM/Admin (User dùng header ngang — xem UserTopBar).
 *
 * ⚠️ TRƯỚC ĐÂY file này HARDCODE 9 mục cho MỌI vai, bỏ qua roles.ts hoàn toàn. Hậu quả:
 * Admin đăng nhập thấy "Thi thử / Lịch sử thi / Tiến độ thi / Luyện nhanh" — toàn bộ là
 * endpoint [Authorize(Roles="User")] nên bấm vào ăn 403. Menu hứa những thứ tài khoản
 * đó không có quyền dùng.
 *
 * Giờ đọc navFor(user) — CÙNG một nguồn sự thật với UserTopBar và RequireRole, nên thêm
 * hay bớt mục chỉ phải sửa roles.ts, không có chuyện hai nơi lệch nhau.
 */
export default function Sidebar() {
    const user = useAuthStore(s => s.user)
    const items = navFor(user)

    return (
        <aside className="flex h-screen w-56 flex-col border-r bg-white">
            <div className="flex h-16 items-center px-6 text-lg font-bold text-blue-600">
                TOEIC Master
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
                {items.map(({ to, icon: Icon, label }) => (
                    // CM_NAV/ADMIN_NAV đều là mục phẳng (children chỉ dùng cho menu ngang
                    // của User), nhưng NavItem.to là optional nên vẫn phải chặn undefined.
                    to ? (
                        <NavLink
                            key={to}
                            to={to}
                            // end CHỈ cho mục gốc "/admin": không có nó thì /admin sáng ở
                            // mọi trang /admin/* và hai mục cùng highlight.
                            // Các mục khác KHÔNG dùng end, để "Quản lý tài khoản" vẫn sáng
                            // khi đang ở trang con /admin/users/:id — mất highlight thì
                            // không biết mình đang ở nhánh nào của sidebar.
                            end={to === '/admin' || to === '/cm'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`
                            }
                        >
                            {Icon && <Icon size={18} />}
                            {label}
                        </NavLink>
                    ) : null
                ))}
            </nav>
        </aside>
    )
}
