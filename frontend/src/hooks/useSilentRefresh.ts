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
    const { isAuthenticated, setAccessToken, logout } = useAuthStore()

    useEffect(() => {
        // localStorage còn "isAuthenticated: true" từ lần trước (persist) → có khả năng
        // còn cookie hợp lệ, thử xin accessToken mới. Không có thì khỏi gọi API vô ích.
        //Chưa đăng nhập nên k cần refresh
        if (!isAuthenticated) { setReady(true); return }
        //Nếu đăng nhập r mà fe -> cookie = null, nhưng isAuthenticate true vì nằm trong local -> refresh
        //request refresh không nên đi qua interceptor vì trong api đã có interceptor r
        axios.post(`${import.meta.env.VITE_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true })
            .then(async (res) => {
                setAccessToken(res.data.accessToken)
                // roles có thể đã đổi từ lần trước (Admin gán role mới) → lấy lại cho chắc
                await profileService.getMe()
            })
            .catch(() => logout())   // cookie hết hạn/không còn → về trạng thái chưa đăng nhập
            .finally(() => setReady(true))
    }, [])   // chỉ chạy 1 lần lúc mount

    return ready
}