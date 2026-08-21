import { LogOut, User as UserIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { authService } from '@/services/auth.service'

export default function Header() {
    const { user, logout } = useAuthStore()

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

    return (
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
            <span className="text-sm text-gray-500">
                Xin chào, <span className="font-medium text-gray-800">{user?.fullName}</span>
            </span>
            <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">
                    {user?.xpPoints} XP · {user?.streakDays} ngày streak
                </span>
                {/* CM/Admin cũng có trang cá nhân (đổi tên, ảnh) — /profile mở cho cả ba
                    vai, khớp [Authorize] trần ở ProfileController. */}
                <Button variant="ghost" size="sm" asChild className="gap-2">
                    <Link to="/profile">
                        <UserIcon size={16} />
                        Trang cá nhân
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                    <LogOut size={16} />
                    Đăng xuất
                </Button>
            </div>
        </header>
    )
}