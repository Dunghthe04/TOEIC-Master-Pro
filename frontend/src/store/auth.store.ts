//Lưu trạng thái auth toàn app
//Chỉ re-render lại component nào dùng đúng field thay đổi
//persist middleware tự động sync store với localStorage mỗi khi thay đổi và khôi phục lại khi user load trang
//partialize chỉ lưu user và isAuthenticated vào localStorage, không lưu các hàm (loginSuccess, logout).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { saveTokens, clearTokens } from '../lib/token'
import type { User } from '@/types/auth.types'

//Định nghĩa ra trạng thái auth
interface AuthState {
    user: User | null,
    //Đã đăng nhập hay chưa
    isAuthenticated: boolean,
    //Hàm xử lý login ko trả về gì, nhiệm vụ là lưu token + cập nhập store
    loginSuccess: (tokens: { accessToken: string; refreshToken: string }, user: User) => void
    //Hàm logout
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,

            // Gọi sau khi login thành công: lưu token + lưu user vào store
            loginSuccess: ({ accessToken, refreshToken }, user) => {
                saveTokens(accessToken, refreshToken)
                set({ user, isAuthenticated: true })
            },

            // Xóa token + reset store về trạng thái chưa login
            logout: () => {
                clearTokens()
                set({ user: null, isAuthenticated: false })
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)
