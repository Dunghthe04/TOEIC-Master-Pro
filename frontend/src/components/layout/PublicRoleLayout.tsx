/**
 * Layout cho các route CÔNG KHAI nhưng vẫn cần header khi đã đăng nhập.
 *
 * VẤN ĐỀ NÓ GIẢI QUYẾT: `/exam-schedule` và `/mock-test/:id` là route công khai
 * (khách chưa đăng ký xem được lịch thi và cấu trúc đề). Để làm vậy, chúng được
 * đưa ra NGOÀI <ProtectedRoute> — nhưng <RoleLayout> lại nằm BÊN TRONG đó, nên
 * ra khỏi ProtectedRoute là mất luôn header/sidebar. User đang đăng nhập bấm vào
 * "Lịch thi TOEIC" trên menu thì rơi vào một trang trơ trọi, không có đường quay lại.
 *
 * VÌ SAO KHÔNG DÙNG THẲNG <RoleLayout>: UserTopBar có avatar và mục "Đăng xuất".
 * Hiện những thứ đó cho khách vãng lai là vô nghĩa — họ chưa có tài khoản nào để
 * đăng xuất. Các trường đều optional-chain nên không nổ, nhưng sẽ hiện avatar "?"
 * kèm menu đăng xuất, trông như lỗi.
 */
import { Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import RoleLayout from './RoleLayout'
import PublicGuestHeader from './PublicGuestHeader'

export default function PublicRoleLayout() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
    if (isAuthenticated) return <RoleLayout />
    // Chưa đăng nhập: KHÔNG dùng UserTopBar (avatar/đăng xuất vô nghĩa với khách),
    // nhưng vẫn cần 1 header tối giản để có đường quay lại "/" — trước đây render
    // trần <Outlet/> khiến trang này thành "cụt đường", không cách nào quay lại.
    return (
        <>
            <PublicGuestHeader />
            <Outlet />
        </>
    )
}
