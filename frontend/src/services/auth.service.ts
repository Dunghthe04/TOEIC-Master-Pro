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

    //Flow Google OAuth: Google → cấp idToken cho frontend 
    //→ frontend gửi idToken lên backend 
    //→ backend xác thực mã mã fe gửi với mã clientId trong appsetting 
    //→ backend tạo JWT của hệ thống → trả về cho frontend.

    async googleLogin(idToken: string): Promise<AuthResponse> {
        const res = await api.post<AuthResponse>('/auth/google-login', { idToken })
        return res.data;
    }

}