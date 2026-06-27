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