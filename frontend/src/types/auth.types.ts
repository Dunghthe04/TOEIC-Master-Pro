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

export interface AuthResponse {
    accessToken: string
    refreshToken: string
    expiresAt: string
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
}

