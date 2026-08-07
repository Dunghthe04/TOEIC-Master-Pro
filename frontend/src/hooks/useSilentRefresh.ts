/**
 * Gọi MỘT LẦN khi app khởi động: nếu có cookie refreshToken hợp lệ (từ lần đăng
 * nhập trước, sống sót qua F5/đóng tab) thì xin accessToken mới ngay — không phải
 * đợi user bấm gì rồi mới lộ ra "ơ, chưa đăng nhập".
 * 
 * F5  -> app khởi động -> call refreshToken -> set accessToken -> render
 */
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'
import { profileService } from '@/services/profile.service'

export function useSilentRefresh() {
    const [ready, setReady] = useState(false)// khi nào ready= true (refresh xong) mới render
    const { isAuthenticated, setAccessToken, loginSuccess, logout } = useAuthStore()

    useEffect(() => {
        // localStorage còn "isAuthenticated: true" từ lần trước (persist) → có khả năng
        // còn cookie hợp lệ, thử xin accessToken mới. Không có thì khỏi gọi API vô ích.
        //Chưa đăng nhập nên k cần refresh
        if (!isAuthenticated) { setReady(true); return }
        //Nếu đăng nhập r mà fe -> cookie = null, nhưng isAuthenticate true vì nằm trong local -> refresh
        //request refresh không nên đi qua interceptor vì trong api đã có interceptor r
        axios.post(`${import.meta.env.VITE_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true })
            .then(async (res) => {
                // Set token TRƯỚC để api interceptor có Bearer khi gọi getMe() ngay dưới.
                setAccessToken(res.data.accessToken)
                // Lấy user MỚI (roles/XP có thể đã đổi ở server) rồi GHI vào store qua
                // loginSuccess — trước đây gọi getMe() nhưng vứt kết quả nên user vẫn là
                // bản cũ từ localStorage, F5 xong role/XP không cập nhật.
                const user = await profileService.getMe()
                loginSuccess(res.data.accessToken, user)
            })
            .catch(() => logout())   // cookie hết hạn/không còn → về trạng thái chưa đăng nhập
            .finally(() => setReady(true))
    }, [])   // chỉ chạy 1 lần lúc mount

    return ready
}