//Tạo 1 axios instance dùng chung — có baseURL trỏ đúng backend, có interceptor tự gắn JWT vào mọi request.
import axios from 'axios'
import { useAuthStore } from '@/store/auth.store'

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
    // BẮT BUỘC: không có dòng này, trình duyệt KHÔNG gửi kèm cookie refreshToken
    // dù CORS phía server đã AllowCredentials(). Phải khớp ở CẢ HAI phía.
    withCredentials: true,// cả be và fe đều đồng ý, còn măc định cookie sẽ k được truyền qua origin khác nhau
});

// Gắn Bearer JWT từ RAM (Zustand) trước khi gửi — không còn đọc localStorage
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error))

/**
 * Gộp mọi request 401 đồng thời vào MỘT lần gọi refresh — nhiều request cùng lúc
 * gặp 401 (vd F5 trang dashboard gọi 3 API song song) mà không gộp thì gọi
 * /refresh-token 3 lần, và refresh token rotation làm 2 lần sau thất bại vì
 * token đầu tiên đã bị revoke. Cùng pattern với chống thundering herd ở media token.
 */ 
let refreshPromise: Promise<string> | null = null

/**
 * Endpoint KHÔNG dùng accessToken → 401 ở đây nghĩa là "sai mật khẩu / token reset
 * không hợp lệ", KHÔNG phải "accessToken hết hạn".
 *
 * Vì sao cần: từ khi backend trả 401 (thay vì 400) cho sai credential, interceptor
 * dưới đây coi mọi 401 là token hết hạn → gõ sai mật khẩu ở form login sẽ kích một
 * lần gọi /refresh-token vô nghĩa, và vì lần đó cũng 401 nên nó chạy logout(), xóa
 * luôn phiên đang đăng nhập của người dùng. Tất cả endpoint auth công khai đều nằm
 * dưới /auth/ — trừ /auth/logout, cái duy nhất cần Bearer.
 */
function isPublicAuthEndpoint(url?: string): boolean {
    if (!url) return false
    return url.includes('/auth/') && !url.includes('/auth/logout')
}

/**
 * EXPORT (không còn private): useSilentRefresh phải gọi ĐÚNG hàm này thay vì tự
 * `axios.post` thô. Gọi thô là đi vòng qua lớp gộp promise ngay dưới — hai lời gọi
 * song song mang CÙNG một cookie sẽ cùng rotate refresh token ở server, sinh race.
 */
export async function refreshAccessToken(): Promise<string>{
    if(refreshPromise) return refreshPromise

    // BASE_URL (không có VITE_) là biến dựng sẵn của Vite cho asset path, mặc định "/" —
    // KHÔNG phải backend URL. Dùng nhầm nó thì request gọi vào chính frontend, không tới API.
    refreshPromise = axios
        .post(`${import.meta.env.VITE_BASE_URL}/auth/refresh-token`, {}, { withCredentials: true })
        .then((res) => {
            const { accessToken } = res.data
            useAuthStore.getState().setAccessToken(accessToken)
            return accessToken
        })
        .finally(() => { refreshPromise = null })

    return refreshPromise
}
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config

        // 401 lần đầu (chưa retry) và không phải endpoint auth công khai —
        // isPublicAuthEndpoint đã loại luôn cả /auth/refresh-token nên không còn nguy
        // cơ lặp vô hạn khi refresh cũng trả 401.
        if (error.response?.status === 401 && !original._retry && !isPublicAuthEndpoint(original.url)) {
            original._retry = true
            try {
                
                const newToken = await refreshAccessToken()
                original.headers.Authorization = `Bearer ${newToken}`
                return api(original)          // gọi lại request GỐC với token mới
            } catch (refreshError) {
                // CHỈ 401 mới nghĩa là refresh token thật sự không dùng được nữa.
                // 429 (chạm rate limit) hay lỗi mạng/server 5xx thì token VẪN CÒN TỐT —
                // đăng xuất lúc đó là biến một trục trặc tạm thời thành mất phiên làm việc,
                // và giữa bài thi thì đồng nghĩa mất bài.
                const status = axios.isAxiosError(refreshError)
                    ? refreshError.response?.status
                    : undefined

                if (status === 401) {
                    // CHỈ xóa state, KHÔNG hard-redirect '/login' ở đây nữa.
                    // Lý do: interceptor này chạy cho MỌI request, kể cả request "optional"
                    // ở trang CÔNG KHAI (VD ExamSchedulePage gọi getMyReminders() để biết
                    // chuông nào đã bật — khách chưa đăng nhập 401 là BÌNH THƯỜNG, trang
                    // vẫn phải xem được, code gọi đã tự bắt lỗi này rồi).
                    // Hard-redirect trước đây đè lên MỌI trang bất kể công khai hay không.
                    // Với trang THẬT SỰ cần đăng nhập, logout() ở đây đã đủ: nó set
                    // isAuthenticated=false trong store, ProtectedRoute tự re-render và
                    // <Navigate to="/login"/> ngay — không cần ép thêm bằng window.location.
                    useAuthStore.getState().logout()
                    try { localStorage.removeItem('auth-storage') } catch { /* ignore */ }
                }
                // Không phải 401 → để lỗi gốc rơi xuống dưới cho caller tự xử lý/retry.
            }
        }

        return Promise.reject(error)
    }
)

export default api
