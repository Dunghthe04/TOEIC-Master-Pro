import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth.service'
import { Eye, EyeOff } from 'lucide-react'

// Cùng bộ luật với RegisterPage — và phải khớp Program.cs (RequiredLength=8,
// RequireUppercase, RequireDigit, RequireNonAlphanumeric). Lệch thì user bị
// backend từ chối sau khi form đã báo hợp lệ.
const schema = z.object({
    newPassword: z
        .string()
        .min(8, 'Mật khẩu tối thiểu 8 ký tự')
        .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
        .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số')
        .regex(/[^a-zA-Z0-9]/, 'Phải có ít nhất 1 ký tự đặc biệt'),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
})

type ResetForm = z.infer<typeof schema>

// Đích của link trong email đặt lại mật khẩu (AuthService.ForgotPasswordAsync).
// Khác ConfirmEmailPage ở chỗ KHÔNG tự gọi API lúc mount: đặt lại mật khẩu cần
// người dùng nhập mật khẩu mới, nên đây là form chứ không phải trang tự xử lý.
export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const [successMsg, setSuccessMsg] = useState('')
    const [serverError, setServerError] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    const email = searchParams.get('email')
    const token = searchParams.get('token')

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetForm>({
        resolver: zodResolver(schema)
    })

    const onSubmit = async (data: ResetForm) => {
        setSuccessMsg('')
        setServerError('')
        try {
            const res = await authService.resetPassword({
                email: email!,
                token: token!,
                newPassword: data.newPassword,
            })
            setSuccessMsg(res.message)
        } catch (error: any) {
            setServerError(error.response?.data?.error ?? 'Đặt lại mật khẩu thất bại, thử lại sau.')
        }
    }

    // Vào trang bằng cách gõ URL trần (không qua link trong mail) thì không có gì
    // để gửi lên — chặn ngay, đừng để user gõ xong mật khẩu rồi mới báo lỗi.
    if (!email || !token) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">Link không hợp lệ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-center">
                        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            Link đặt lại mật khẩu thiếu email hoặc token. Hãy mở lại link trong email,
                            hoặc yêu cầu gửi link mới.
                        </p>
                        <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                            Yêu cầu link mới
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Đặt lại mật khẩu</CardTitle>
                    <CardDescription>Nhập mật khẩu mới cho {email}</CardDescription>
                </CardHeader>
                <CardContent>
                    {successMsg ? (
                        <div className="space-y-4 text-center">
                            <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                {successMsg}
                            </p>
                            <Link to="/login" className="text-sm text-blue-600 hover:underline">
                                Đăng nhập bằng mật khẩu mới
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="newPassword">Mật khẩu mới</Label>
                                <div className="relative">
                                    <Input
                                        id="newPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        {...register('newPassword')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.newPassword && <p className="text-sm text-red-500">{errors.newPassword.message}</p>}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirm ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        {...register('confirmPassword')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    >
                                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
                            </div>

                            {serverError && (
                                <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
                                    {serverError}
                                </p>
                            )}

                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? 'Đang đặt lại...' : 'Đặt lại mật khẩu'}
                            </Button>

                            <p className="text-center text-sm text-gray-600">
                                <Link to="/login" className="text-blue-600 hover:underline">Quay lại đăng nhập</Link>
                            </p>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
