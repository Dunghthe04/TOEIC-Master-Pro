//Thanh điều hướng bên trái — hiển thị các mục menu chính của app.
//Dùng NavLink thay vì Link vì NavLink tự nhận biết route đang active để highlight menu đang chọn.

import { NavLink } from "react-router-dom";
import { LayoutDashboard, BookOpen, ClipboardList, BookMarked, Calendar, FileText, HelpCircle } from 'lucide-react'

const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/practice', icon: BookOpen, label: 'Luyện tập' },
    { to: '/mock-test', icon: ClipboardList, label: 'Thi thử' },
    { to: '/vocabulary', icon: BookMarked, label: 'Từ vựng' },
    { to: '/exam-schedule', icon: Calendar, label: 'Lịch thi' },
    { to: '/cm/tests', icon: FileText, label: 'Quản lý đề thi' },
    { to: '/cm/questions', icon: HelpCircle, label: 'Quản lý câu hỏi' },
]

export default function Sidebar() {
    return (
        <aside className="flex h-screen w-56 flex-col border-r bg-white">
            <div className="flex h-16 items-center px-6 text-lg font-bold text-blue-600">
                TOEIC Master
            </div>
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navItems.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${isActive
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`
                        }
                    >
                        <Icon size={18} />
                        {label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    )
}