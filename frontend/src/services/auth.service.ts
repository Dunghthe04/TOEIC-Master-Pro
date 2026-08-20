//Tập chung toàn bộ lời gọi api auth vào một chỗ, các page chỉ được gọi service k đc gọi axios
import api from "@/api/axios"
import type { LoginRequest, RegisterRequest, ForgotPasswordRequest, ResetPasswordRequest, AuthResponse } from '@/types/auth.types';

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

    //Đặt lại mật khẩu — email/token lấy từ query string của link trong mail,
    //KHÔNG phải người dùng tự gõ (token là bằng chứng đọc được hộp thư).
    async resetPassword(data: ResetPasswordRequest): Promise<{ message: string }> {
        const res = await api.post<{ message: string }>('/auth/reset-password', data)
        return res.data
    },

    // Xác nhận email — userId/token lấy từ query string của link trong mail
    async confirmEmail(userId: string, token: string): Promise<{ message: string }> {
        const res = await api.get<{ message: string }>('/auth/confirm-email', {
            params: { userId, token },
        })
        return res.data
    },

    //Flow Google OAuth: Google → cấp idToken cho frontend 
    //→ frontend gửi idToken lên backend 
    //→ backend xác thực mã mã fe gửi với mã clientId trong appsetting 
    //→ backend tạo JWT của hệ thống → trả về cho frontend.

    async googleLogin(idToken: string): Promise<AuthResponse> {
        const res = await api.post<AuthResponse>('/auth/google-login', { idToken })
        return res.data;
    },

    //Báo server thu hồi refreshToken trong DB (RevokedAt) + xóa cookie httpOnly.
    //Không gọi cái này thì cookie vẫn sống, refresh-token vẫn cấp được accessToken mới
    //dù UI đã "đăng xuất" — xem CookieAuthExtensions.ClearRefreshTokenCookie ở backend.
    async logout(): Promise<void> {
        await api.post('/auth/logout')   // cookie tự gửi kèm nhờ withCredentials: true
    }
}