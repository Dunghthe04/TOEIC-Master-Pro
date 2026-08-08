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
import { refreshAccessToken } from '@/api/axios'
import { profileService } from '@/services/profile.service'

/**
 * Guard cấp MODULE, không phải cấp component.
 *
 * <StrictMode> ở dev cố ý mount → cleanup → mount lại, nên useEffect chạy HAI lần
 * dù deps là []. Trước đây mỗi lần F5 vì thế bắn 2 request /auth/refresh-token:
 * ăn gấp đôi quota rate limit, và hai request mang cùng một cookie đua nhau rotate
 * token ở server.
 *
 * useRef không cứu được — StrictMode dựng component MỚI nên ref cũng mới. Chỉ biến
 * ở module scope mới sống xuyên qua vòng mount thứ hai.
 *
 * Lưu ý deliberate: biến này KHÔNG bao giờ được reset. Đúng ý đồ — ngữ nghĩa cần là
 * "bootstrap một lần mỗi lần tải trang", mà F5 thì cả module nạp lại từ đầu.
 */
let bootstrapPromise: Promise<void> | null = null

export function useSilentRefresh() {
    const [ready, setReady] = useState(false)// khi nào ready= true (refresh xong) mới render
    const { isAuthenticated, setAccessToken, loginSuccess, logout } = useAuthStore()

    useEffect(() => {
        // localStorage còn "isAuthenticated: true" từ lần trước (persist) → có khả năng
        // còn cookie hợp lệ, thử xin accessToken mới. Không có thì khỏi gọi API vô ích.
        //Chưa đăng nhập nên k cần refresh
        if (!isAuthenticated) { setReady(true); return }

        // Lần chạy thứ hai của StrictMode rơi vào đây: promise đã tồn tại nên nó CHỜ
        // kết quả của lần một thay vì bắn thêm một request nữa.
        bootstrapPromise ??= (async () => {
            try {
                // Dùng chung hàm trong axios.ts — hàm đó đã gộp mọi lời gọi đồng thời
                // vào MỘT request, nên kể cả interceptor 401 chạy cùng lúc cũng không
                // sinh thêm lần rotate thứ hai.
                const accessToken = await refreshAccessToken()
                // Set token TRƯỚC để api interceptor có Bearer khi gọi getMe() ngay dưới.
                setAccessToken(accessToken)
                // Lấy user MỚI (roles/XP có thể đã đổi ở server) rồi GHI vào store qua
                // loginSuccess — trước đây gọi getMe() nhưng vứt kết quả nên user vẫn là
                // bản cũ từ localStorage, F5 xong role/XP không cập nhật.
                const user = await profileService.getMe()
                loginSuccess(accessToken, user)
            } catch (err) {
                // Trước đây ở đây là `.catch(() => logout())` — nuốt MỌI lỗi thành "hết
                // phiên". Một cú 429 vì F5 nhiều lần, hay mạng chớp một nhịp, cũng đá
                // user về /login dù refresh token còn nguyên giá trị.
                // Chỉ 401 mới là bằng chứng cookie thật sự không dùng được nữa.
                const status = axios.isAxiosError(err) ? err.response?.status : undefined
                if (status === 401) logout()
                // Lỗi khác → giữ nguyên trạng thái đăng nhập. accessToken còn null, nhưng
                // request đầu tiên gặp 401 sẽ kích interceptor refresh lại — tự lành.
            }
        })()

        bootstrapPromise.finally(() => setReady(true))
    }, [])   // chỉ chạy 1 lần lúc mount

    return ready
}
