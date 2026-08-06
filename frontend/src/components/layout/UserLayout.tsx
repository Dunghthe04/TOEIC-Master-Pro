/**
 * Layout cho học viên (role User) — header NGANG, nội dung ở giữa, có max-width.
 *
 * Khác MainLayout (sidebar dọc, dùng cho CM/Admin): User là người dùng cuối nên UI
 * hướng sản phẩm — giống các trang học TOEIC thật. CM/Admin là người vận hành nên
 * UI hướng công cụ, cần nhiều chỗ cho bảng dữ liệu.
 */
import { Outlet } from 'react-router-dom'
import UserTopBar from './UserTopBar'

export default function UserLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <UserTopBar />
            {/* max-w-[1600px]: nới rộng so với 7xl (1280px) để dashboard/bảng không bị bó
                vào giữa trên màn rộng, nhưng vẫn có trần để dòng chữ không dài quá khó đọc. */}
            <main className="mx-auto max-w-[1600px] px-6 py-6">
                <Outlet />
            </main>
        </div>
    )
}
