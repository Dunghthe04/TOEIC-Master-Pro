/**
 * Nguồn sự thật duy nhất về phân vai ở frontend.
 *
 * ⚠️ NGUYÊN TẮC: ẩn menu là GIẤU, chặn route là KHÓA — nhưng CẢ HAI chỉ là UX.
 * Bảo mật thật nằm ở [Authorize(Roles=...)] phía server (Day 35). Frontend chạy
 * trên máy người dùng nên họ sửa được tất cả. Không bao giờ tin frontend.
 *
 * Ba vai không giao nhau: User THI · CM SOẠN nội dung · Admin QUẢN người + xem tổng quan.
 */
import type { LucideIcon } from 'lucide-react'
import {
    LayoutDashboard, ClipboardList, History, TrendingUp, BookOpen, BookMarked,
    Calendar, FileText, HelpCircle, Upload, Users, BarChart3, Home,
} from 'lucide-react'
import type { User } from '@/types/auth.types'

export type Role = 'User' | 'ContentManager' | 'Admin'

export function hasRole(user: User | null, role: Role): boolean {
    return user?.roles?.includes(role) ?? false
}
export const isAdmin = (u: User | null) => hasRole(u, 'Admin')
export const isContentManager = (u: User | null) => hasRole(u, 'ContentManager')
export const isLearner = (u: User | null) => hasRole(u, 'User')

/**
 * Vai chính để chọn layout + trang chủ. Một tài khoản về lý thuyết có nhiều role,
 * nên phải có thứ tự ưu tiên rõ ràng: Admin > CM > User.
 */
export function primaryRole(user: User | null): Role {
    if (isAdmin(user)) return 'Admin'
    if (isContentManager(user)) return 'ContentManager'
    return 'User'
}

/** Trang chủ sau khi đăng nhập — mỗi vai một nơi. */
export const HOME_BY_ROLE: Record<Role, string> = {
    User: '/dashboard',
    ContentManager: '/cm',
    Admin: '/admin',
}
export const homeFor = (user: User | null) => HOME_BY_ROLE[primaryRole(user)]

/** Một mục menu. `children` chỉ dùng cho header ngang của User (dropdown). */
export type NavItem = {
    to?: string
    label: string
    icon?: LucideIcon
    children?: { to: string; label: string; icon?: LucideIcon }[]
}

/**
 * Menu NGANG cho User — gộp 7 mục phẳng thành 4 nhóm theo mục đích.
 * 7 mục phẳng thì chật trên laptop 1366px; nhóm lại cũng dễ hiểu hơn.
 */
export const USER_NAV: NavItem[] = [
    { to: '/dashboard', label: 'Trang chủ', icon: LayoutDashboard },
    {
        label: 'Thi thử',
        icon: ClipboardList,
        children: [
            { to: '/mock-test', label: 'Thi thử mới', icon: ClipboardList },
            { to: '/mock-test/history', label: 'Lịch sử thi', icon: History },
            { to: '/mock-test/progress', label: 'Tiến độ', icon: TrendingUp },
        ],
    },
    {
        label: 'Học tập',
        icon: BookOpen,
        children: [
            { to: '/practice', label: 'Luyện nhanh', icon: BookOpen },
            { to: '/vocabulary', label: 'Từ vựng', icon: BookMarked },
        ],
    },
    { to: '/exam-schedule', label: 'Lịch thi TOEIC', icon: Calendar },
]

/** Menu DỌC cho CM — công cụ làm việc, phẳng để bấm nhanh. */
export const CM_NAV: NavItem[] = [
    { to: '/cm', label: 'Trang chủ', icon: Home },
    { to: '/cm/tests', label: 'Quản lý đề thi', icon: FileText },
    { to: '/cm/questions', label: 'Quản lý câu hỏi', icon: HelpCircle },
    { to: '/cm/questions/import', label: 'Import câu hỏi', icon: Upload },
    { to: '/vocabulary', label: 'Quản lý từ vựng', icon: BookMarked },
    { to: '/exam-schedule', label: 'Quản lý lịch thi', icon: Calendar },
]

/**
 * Menu DỌC cho Admin.
 * Admin là "sếp": xem tổng quan + quản account. KHÔNG soạn nội dung, KHÔNG thi.
 * Backend chặn thật: DELETE /api/question với token Admin → 403.
 *
 * ⚠️ KHÔNG thêm các mục của User (Thi thử, Luyện nhanh, Tiến độ) vào đây: những
 * endpoint đó là [Authorize(Roles="User")] nên Admin bấm vào chỉ nhận 403. Menu không
 * được hứa thứ tài khoản đó không dùng được.
 */
export const ADMIN_NAV: NavItem[] = [
    { to: '/admin', label: 'Tổng quan hệ thống', icon: BarChart3 },
    { to: '/admin/users', label: 'Quản lý tài khoản', icon: Users },
    // Nội dung: Admin XEM được (GET đã mở "ContentManager,Admin"), nhưng KHÔNG sửa —
    // trang /admin/content không có nút CRUD nào. Không trỏ sang /cm/* vì những trang
    // đó đầy nút tạo/sửa/xoá mà Admin bấm vào chỉ nhận 403.
    { to: '/admin/content', label: 'Nội dung hệ thống', icon: FileText },
]

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
    User: USER_NAV,
    ContentManager: CM_NAV,
    Admin: ADMIN_NAV,
}
export const navFor = (user: User | null) => NAV_BY_ROLE[primaryRole(user)]

/** User dùng header NGANG (hướng sản phẩm); CM/Admin dùng sidebar DỌC (hướng công cụ). */
export const usesTopNav = (user: User | null) => primaryRole(user) === 'User'
