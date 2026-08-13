/**
 * Header NGANG cho học viên (role User).
 *
 * Vì sao ngang mà CM/Admin dọc: User là người dùng cuối → UI hướng sản phẩm, giống
 * các trang học TOEIC thật. CM/Admin là người vận hành → UI hướng công cụ (sidebar).
 *
 * Menu gộp 7 mục phẳng thành 4 nhóm (xem USER_NAV) vì 7 mục chật trên laptop 1366px.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, Flame, LogOut, Menu, User as UserIcon, X, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { USER_NAV, type NavItem } from '@/lib/roles'
import { getMediaUrl } from '@/lib/media'
import { authService } from '@/services/auth.service'

export default function UserTopBar() {
    const location = useLocation()
    const { user, logout } = useAuthStore()

    const [openMenu, setOpenMenu] = useState<string | null>(null)   // dropdown desktop đang mở
    const [mobileOpen, setMobileOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)
    const navRef = useRef<HTMLDivElement>(null)

    // Đóng mọi dropdown khi click ra ngoài — thiếu cái này thì menu dính lại, rất khó chịu
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (!navRef.current?.contains(e.target as Node)) {
                setOpenMenu(null)
                setUserMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [])

    // Đổi trang thì đóng hết — nếu không, dropdown vẫn mở sau khi điều hướng
    useEffect(() => {
        setOpenMenu(null)
        setMobileOpen(false)
        setUserMenuOpen(false)
    }, [location.pathname])

    const handleLogout = async () => {
        try {
            await authService.logout()   // báo server thu hồi DB + xóa cookie refreshToken
        } catch {
            // Lỗi mạng lúc gọi logout không được kẹt user lại trong app — vẫn thoát ở finally
        } finally {
            // HARD redirect (window.location), KHÔNG dùng navigate() của React Router.
            // Đã thử 3 cách điều hướng SPA (đổi thứ tự, setTimeout, unstable_batchedUpdates)
            // — vẫn dính race giữa ProtectedRoute (route cũ thấy isAuthenticated=false →
            // tự <Navigate to="/login"/>) và effect "đã login thì về home" của LandingPage
            // (route mới thấy isAuthenticated vẫn true vì chưa kịp xóa). Load lại trang
            // từ đầu thì không còn state "nửa vời" nào để 2 effect đó tranh nhau —
            // logout() xong rồi mới rời trang, App mount lại 100% sạch với isAuthenticated=false.
            logout()   // xóa state RAM + ghi localStorage (persist middleware) TRƯỚC khi rời trang
            window.location.href = '/'
        }
    }

    /** Nhóm có con nào đang active → highlight cả nhóm */
    const groupActive = (item: NavItem) =>
        item.children?.some(c => location.pathname === c.to || location.pathname.startsWith(c.to + '/')) ?? false

    return (
        <header className="sticky top-0 z-40 bg-blue-600 text-white shadow-sm">
            {/* Không giới hạn max-width: header là thanh điều hướng nên trải hết chiều
                ngang cho thoáng. Nội dung bên dưới (UserLayout) mới cần bó lại cho dễ đọc. */}
            <div className="flex h-16 items-center gap-4 px-6" ref={navRef}>

                {/* Logo */}
                <Link to="/dashboard" className="flex shrink-0 items-center gap-2 font-bold">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-blue-600">T</span>
                    <span className="hidden text-lg sm:inline">TOEIC Master</span>
                </Link>

                {/* Đẩy menu ra giữa: hai flex-1 hai bên "ép" nav vào chính giữa header,
                    không phụ thuộc độ rộng của logo hay nhóm nút bên phải. */}
                <div className="hidden flex-1 lg:block" />

                {/* Menu desktop */}
                <nav className="hidden items-center gap-1 lg:flex">
                    {USER_NAV.map(item =>
                        item.children ? (
                            <div key={item.label} className="relative">
                                <button
                                    onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                                    className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors
                                        ${groupActive(item) || openMenu === item.label
                                            ? 'bg-blue-700 text-white'
                                            : 'text-blue-50 hover:bg-blue-700'}`}
                                >
                                    {item.label}
                                    <ChevronDown
                                        size={15}
                                        className={`transition-transform ${openMenu === item.label ? 'rotate-180' : ''}`}
                                    />
                                </button>

                                {openMenu === item.label && (
                                    <div className="absolute left-0 top-full mt-1 min-w-52 overflow-hidden rounded-lg border bg-white py-1 shadow-lg">
                                        {item.children.map(c => (
                                            <NavLink
                                                key={c.to}
                                                to={c.to}
                                                className={({ isActive }) =>
                                                    `flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                                                     ${isActive
                                                        ? 'bg-blue-50 font-medium text-blue-700'
                                                        : 'text-gray-700 hover:bg-gray-50'}`
                                                }
                                            >
                                                {c.icon && <c.icon size={16} />}
                                                {c.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <NavLink
                                key={item.to}
                                to={item.to!}
                                end={item.to === '/dashboard'}
                                className={({ isActive }) =>
                                    `rounded-md px-3 py-2 text-sm font-medium transition-colors
                                     ${isActive ? 'bg-blue-700 text-white' : 'text-blue-50 hover:bg-blue-700'}`
                                }
                            >
                                {item.label}
                            </NavLink>
                        )
                    )}
                </nav>

                {/* Cặp flex-1 thứ hai — cùng cái ở trên tạo thế cân, nav nằm giữa.
                    Trên mobile (menu ẩn) nó vẫn hoạt động như spacer đẩy nút sang phải. */}
                <div className="flex-1" />

                {/* XP + streak — chỉ hiện với học viên (CM/Admin không có gamification) */}
                <div className="hidden items-center gap-2 md:flex">
                    <span
                        className="flex items-center gap-1.5 rounded-full bg-blue-700/60 px-3 py-1.5 text-xs font-semibold"
                        title={`${user?.xpPoints ?? 0} điểm kinh nghiệm`}
                    >
                        <Zap size={14} className="text-yellow-300" />
                        {user?.xpPoints ?? 0} XP
                    </span>
                    <StreakBadge days={user?.streakDays ?? 0} />
                </div>

                {/* CTA — mục đích chính của app, để nổi bật như "TEST ONLINE" của các trang TOEIC */}
                <Link
                    to="/mock-test"
                    className="hidden shrink-0 rounded-md bg-orange-500 px-4 py-2 text-sm font-bold uppercase
                               tracking-wide shadow transition-colors hover:bg-orange-600 sm:block"
                >
                    Thi thử ngay
                </Link>

                {/* Avatar + dropdown */}
                <div className="relative shrink-0">
                    <button
                        onClick={() => setUserMenuOpen(v => !v)}
                        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-blue-700"
                    >
                        {user?.avatarUrl ? (
                            <img
                                src={getMediaUrl(user.avatarUrl)}
                                alt=""
                                className="h-8 w-8 rounded-full object-cover ring-2 ring-white/40"
                            />
                        ) : (
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-800 text-sm font-semibold">
                                {user?.fullName?.[0]?.toUpperCase() ?? '?'}
                            </span>
                        )}
                        <ChevronDown size={14} className="hidden sm:block" />
                    </button>

                    {userMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-lg border bg-white shadow-lg">
                            <div className="border-b px-4 py-3">
                                <p className="truncate text-sm font-medium text-gray-900">{user?.fullName}</p>
                                <p className="truncate text-xs text-gray-500">{user?.email}</p>
                                {/* Nhắc lại XP/streak ở đây cho mobile — thanh trên đã ẩn ở md: */}
                                <p className="mt-1.5 flex items-center gap-2 text-xs text-gray-500 md:hidden">
                                    <Zap size={12} className="text-amber-500" />{user?.xpPoints ?? 0} XP
                                    <Flame size={12} className="text-orange-500" />{user?.streakDays ?? 0} ngày
                                </p>
                            </div>
                            <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
                                <UserIcon size={16} /> Trang cá nhân
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                            >
                                <LogOut size={16} /> Đăng xuất
                            </button>
                        </div>
                    )}
                </div>

                {/* Hamburger — mobile */}
                <button
                    onClick={() => setMobileOpen(v => !v)}
                    className="shrink-0 rounded-md p-2 hover:bg-blue-700 lg:hidden"
                    aria-label="Menu"
                >
                    {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            {/* Menu mobile — trải phẳng, không dropdown (bấm trên điện thoại khó) */}
            {mobileOpen && (
                <nav className="border-t border-blue-500 bg-blue-600 pb-3 lg:hidden">
                    {USER_NAV.flatMap(item =>
                        item.children
                            ? [
                                <p key={item.label} className="px-5 pb-1 pt-3 text-xs font-semibold uppercase text-blue-200">
                                    {item.label}
                                </p>,
                                ...item.children.map(c => <MobileLink key={c.to} to={c.to} label={c.label} indent />),
                            ]
                            : [<MobileLink key={item.to} to={item.to!} label={item.label} />]
                    )}
                </nav>
            )}
        </header>
    )
}

/**
 * Streak — càng nhiều ngày càng "cháy": đổi màu + hiệu ứng.
 * Mốc chọn theo tâm lý habit-building: 3 ngày (bắt đầu thành thói quen),
 * 7 ngày (một tuần), 30 ngày (một tháng).
 */
function StreakBadge({ days }: { days: number }) {
    if (days <= 0) {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-blue-700/60 px-3 py-1.5 text-xs font-semibold text-blue-200">
                <Flame size={14} /> 0 ngày
            </span>
        )
    }

    const tier =
        days >= 30 ? { bg: 'bg-gradient-to-r from-red-500 to-orange-400', icon: 'text-yellow-200', pulse: true }
      : days >= 7  ? { bg: 'bg-gradient-to-r from-orange-500 to-amber-400', icon: 'text-yellow-100', pulse: true }
      : days >= 3  ? { bg: 'bg-amber-500', icon: 'text-yellow-100', pulse: false }
      :              { bg: 'bg-blue-700/60', icon: 'text-orange-300', pulse: false }

    return (
        <span
            className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${tier.bg}`}
            title={`Chuỗi ${days} ngày học liên tục`}
        >
            {/* Vòng sáng nhấp nháy — chỉ từ 7 ngày, để mốc thấp không bị nhiễu */}
            {tier.pulse && (
                <span className="absolute inset-0 animate-ping rounded-full bg-orange-400 opacity-40" />
            )}
            <Flame size={14} className={`relative ${tier.icon} ${tier.pulse ? 'animate-pulse' : ''}`} />
            <span className="relative">{days} ngày</span>
        </span>
    )
}

function MobileLink({ to, label, indent }: { to: string; label: string; indent?: boolean }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                `block py-2.5 text-sm ${indent ? 'pl-9' : 'pl-5'} pr-5
                 ${isActive ? 'bg-blue-700 font-medium text-white' : 'text-blue-50 hover:bg-blue-700'}`
            }
        >
            {label}
        </NavLink>
    )
}
