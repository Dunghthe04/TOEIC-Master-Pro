//Mục đích bảo vệ các route chỉ dành cho user đã login. Nếu chưa login -> tự động redirect về /login
//Kiểm tra cả isAuthenticated trong store và getAccessToken() có token thì mới cho vào
//<Outlet /> — đây là nơi component con (trang thực sự) được render khi đã xác thực.

import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { getAccessToken } from "@/lib/token";

export default function ProtectedRoute() {
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    const accessToken = getAccessToken();

    if (!isAuthenticated || !accessToken) {
        return <Navigate to="/login" replace />
    }
    // Nếu đủ đk, render component con
    return <Outlet />
}