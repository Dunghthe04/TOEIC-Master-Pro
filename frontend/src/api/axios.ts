//Tạo 1 axios instance dùng chung — có baseURL trỏ đúng backend, có interceptor tự gắn JWT vào mọi request.
import axios from 'axios'
import { getAccessToken, clearTokens } from '@/lib/token'

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL,
});

// Gắn Bearer JWT trước khi gửi
api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error))

// 401 = token hết hạn / không hợp lệ → xóa session, về login
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            clearTokens()
            // Xóa luôn flag auth trong zustand persist
            try {
                localStorage.removeItem('auth-storage')
            } catch { /* ignore */ }
            if (!window.location.pathname.startsWith('/login')) {
                window.location.href = '/login'
            }
        }
        return Promise.reject(error)
    }
)

export default api
