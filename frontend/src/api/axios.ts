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

async function refreshAccessToken(): Promise<string>{
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

        // 401 lần đầu (chưa retry) và không phải chính request refresh-token bị lỗi
        // (tránh vòng lặp vô hạn nếu refresh cũng trả 401)
        if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/refresh-token')) {
            original._retry = true
            try {
                const newToken = await refreshAccessToken()
                original.headers.Authorization = `Bearer ${newToken}`
                return api(original)          // gọi lại request GỐC với token mới
            } catch {
                // Refresh cũng thất bại (cookie hết hạn/không có) → thật sự phải đăng xuất
                useAuthStore.getState().logout()
                try { localStorage.removeItem('auth-storage') } catch { /* ignore */ }
                if (!window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login'
                }
            }
        }

        return Promise.reject(error)
    }
)

export default api
