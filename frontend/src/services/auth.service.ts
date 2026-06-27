//Tập chung toàn bộ lời gọi api auth vào một chỗ, các page chỉ được gọi service k đc gọi axios
import api from "@/api/axios"
import type { LoginRequest, RegisterRequest, ForgotPasswordRequest, AuthResponse } from '@/types/auth.types';

export const authService = {
    //Login, nhận LoginRequst, trả về AuthResponse
    async Login(data: LoginRequest): Promise<AuthResponse> {
        //Gọi api, gửi body {email, password}-> api trả về {accessToken, refreshToken, expiryAt}
        const res = await api.post('/auth/login', data)
        return res.data;
    },

    //Register
    async Register(data: RegisterRequest): Promise<{ message: string }> {
        const res = await api.post<{ message: string }>('/auth/register', data)
        return res.data
    },

    //forgot password
    async forgotPassword(data: ForgotPasswordRequest): Promise<{ message: string }> {
        const res = await api.post<{ message: string }>('/auth/forgot-password', data)
        return res.data
    },
}