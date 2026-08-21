//Định nghĩa TypeScript interface khớp với DTO của backend(camelCase)
export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    fullName: string
    email: string
    password: string
}

export interface ForgotPasswordRequest {
    email: string
}

// email + token đọc từ query string của link trong mail đặt lại mật khẩu
// (AuthService.ForgotPasswordAsync dựng link), không phải người dùng tự gõ.
export interface ResetPasswordRequest {
    email: string
    token: string
    newPassword: string
}

export interface AuthResponse {
    accessToken: string
    // refreshToken KHÔNG còn trong body — backend chuyển sang httpOnly cookie
    // (Set-Cookie header), FE không cần và không được thấy giá trị này.
    expiresAt: string
}

/**
 * Khớp UpdateProfileRequest bên backend (PUT /api/profile/me).
 * Backend validate: fullName ≤100 ký tự, targetScore 10–990 và là bội số của 5,
 * examDate không được ở quá khứ.
 */
export interface UpdateProfileRequest {
    fullName: string
    targetScore: number
    /** ISO date, hoặc null = chưa định ngày thi */
    examDate: string | null
}

//Khớp với Profile response bên backend để gán vào zustand store
export interface User {
    id: string
    email: string
    fullName: string
    avatarUrl: string | null
    targetScore: number
    examDate: string | null
    plan: string
    xpPoints: number
    streakDays: number
    createdAt: string
    /**
     * Role từ backend (GET /api/profile/me) — dùng để lọc menu và chọn layout.
     * Đọc từ DB, KHÔNG parse JWT: Admin gán role mới thì token cũ chưa biết.
     *
     * ⚠️ Đây chỉ là UX. Bảo mật thật nằm ở [Authorize(Roles=...)] phía server —
     * frontend chạy trên máy người dùng, họ sửa được tất cả.
     */
    roles: string[]
}

