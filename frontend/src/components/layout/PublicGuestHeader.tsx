/**
 * Header tối giản cho khách CHƯA đăng nhập trên route công khai (/exam-schedule,
 * /mock-test/:id) — xem PublicRoleLayout.tsx. Không dùng UserTopBar ở đây vì nó có
 * avatar/"Đăng xuất", vô nghĩa với khách chưa có tài khoản.
 *
 * Dùng lại ĐÚNG danh sách LANDING_NAV của LandingPage — tránh 2 nơi giữ 2 bản nav
 * lệch nhau. Mục cần login (`requireLogin: true`) không mở popup được ở đây (popup
 * sống trong LandingPage) nên trỏ về "/?next=<route>" — LandingPage tự đọc query
 * "next" và mở đúng popup login nhắm tới route đó (xem effect trong LandingPage.tsx).
 */
import { Link } from 'react-router-dom'
import { LANDING_NAV } from '@/pages/LandingPage'

export default function PublicGuestHeader() {
    return (
        <header className="sticky top-0 z-40 bg-blue-600 text-white shadow-sm">
            <div className="flex h-16 items-center gap-4 px-6">
                <Link to="/" className="flex shrink-0 items-center gap-2 font-bold">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-blue-600">E</span>
                    <span className="hidden text-lg sm:inline">ETest</span>
                </Link>

                <div className="hidden flex-1 lg:block" />

                <nav className="hidden items-center gap-1 lg:flex">
                    {LANDING_NAV.map(({ label, to, requireLogin }) => (
                        <Link
                            key={label}
                            to={requireLogin ? `/?next=${encodeURIComponent(to)}` : to}
                            className="rounded-md px-3 py-2 text-sm font-medium text-blue-50
                                       transition-colors hover:bg-blue-700"
                        >
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="flex-1" />

                <Link
                    to="/"
                    className="shrink-0 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold uppercase
                               tracking-wide shadow transition-colors hover:bg-orange-600"
                >
                    Đăng nhập
                </Link>
            </div>
        </header>
    )
}
