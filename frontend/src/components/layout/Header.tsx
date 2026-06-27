import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'

export default function Header() {
    const navigate = useNavigate()
    const { user, logout } = useAuthStore()

    const handleLogout = () => {
        logout()
        navigate('/login')
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
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
                    <LogOut size={16} />
                    Đăng xuất
                </Button>
            </div>
        </header>
    )
}