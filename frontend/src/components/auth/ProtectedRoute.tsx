//Mục đích bảo vệ các route chỉ dành cho user đã login. Nếu chưa login -> tự động redirect về /login
//Chỉ kiểm isAuthenticated trong store — accessToken giờ nằm trong RAM, không còn ở
//localStorage để đọc trực tiếp. App.tsx đã chặn render bằng useSilentRefresh() tới khi
//biết chắc trạng thái đăng nhập, nên isAuthenticated ở đây luôn đã là giá trị mới nhất.
//<Outlet /> — đây là nơi component con (trang thực sự) được render khi đã xác thực.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";

export default function ProtectedRoute() {
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }
    // Nếu đủ đk, render component con
    return <Outlet />
}