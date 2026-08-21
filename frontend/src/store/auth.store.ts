//Lưu trạng thái auth toàn app
//accessToken CHỈ nằm trong RAM (state của store), KHÔNG persist vào localStorage —
//refresh token đã chuyển sang httpOnly cookie nên FE không cần biết giá trị của nó nữa.
//F5 mất accessToken là CHỦ Ý: axios interceptor sẽ tự gọi /api/auth/refresh-token
//(cookie tự động gửi kèm) để lấy access token mới, xem axios.ts.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearMediaTokens } from '@/lib/media'
import type { User } from '@/types/auth.types'

//Định nghĩa ra trạng thái auth
interface AuthState {
    user: User | null,
    accessToken: string | null,
    //Đã đăng nhập hay chưa
    isAuthenticated: boolean,
    //Hàm xử lý login ko trả về gì, nhiệm vụ là lưu token + cập nhập store
    loginSuccess: (accessToken: string, user: User) => void
    /** Gọi khi silent-refresh lúc F5 thành công — CHỈ cập nhật accessToken, giữ nguyên user */
    setAccessToken: (accessToken: string) => void
    /**
     * Cập nhật thông tin user đang đăng nhập (sau khi sửa profile / đổi avatar).
     * CHỈ đổi `user`, không đụng accessToken — không thì sửa tên xong lại rơi vào
     * trạng thái chưa xác thực. Header (UserTopBar) đọc trực tiếp từ store nên tên,
     * avatar, XP đổi ngay, không phải F5.
     */
    setUser: (user: User) => void
    //Hàm logout
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            isAuthenticated: false,

            loginSuccess: (accessToken, user) => {
                set({ accessToken, user, isAuthenticated: true })
            },

            setAccessToken: (accessToken: string) => {
                set({ accessToken, isAuthenticated: true })
            },

            setUser: (user: User) => {
                set({ user })
            },

            // Xóa token + reset store về trạng thái chưa login
            logout: () => {
                clearMediaTokens()
                set({ accessToken: null, user: null, isAuthenticated: false })
            },
        }),
        {
            name: 'auth-storage',
            // ⚠️ accessToken KHÔNG có trong partialize → middleware persist không ghi
            // nó vào localStorage. Chỉ user + isAuthenticated sống qua F5 (để UI biết
            // "có thể đã đăng nhập", còn accessToken thật phải xin lại qua cookie).
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
