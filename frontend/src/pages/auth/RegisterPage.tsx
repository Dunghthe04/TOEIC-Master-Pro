import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth.service'
import { Eye, EyeOff } from 'lucide-react'


//tạo schema validate
const schema = z.object({
    fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
    email: z.string().email('Email không hợp lệ'),
    password: z
        .string()
        .min(8, 'Mật khẩu tối thiểu 8 ký tự')
        .regex(/[A-Z]/, 'Phải có ít nhất 1 chữ hoa')
        .regex(/[0-9]/, 'Phải có ít nhất 1 chữ số')
        .regex(/[^a-zA-Z0-9]/, 'Phải có ít nhất 1 ký tự đặc biệt'),
    confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
})

//Tự định nghĩa kiểu
type RegisterForm = z.infer<typeof schema>

export default function Register() {
    const [successMsg, setSuccessMsg] = useState('');
    const [serverError, setserverError] = useState('');
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    //khởi tạo form
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
        resolver: zodResolver(schema)
    })

    const onSubmit = async (data: RegisterForm) => {
        setSuccessMsg('');
        setserverError('');
        try {
            const res = await authService.Register(data);
            setSuccessMsg(res.message);
        } catch (error) {
            setserverError(error.response?.data?.error ?? 'Đăng ký thất bại, thử lại sau.')
        }
    }
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
                    <CardDescription>Bắt đầu hành trình chinh phục TOEIC</CardDescription>
                </CardHeader>
                <CardContent>
                    {successMsg ? (
                        <div className="space-y-4">
                            <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                                {successMsg}
                            </p>
                            <p className="text-center text-sm text-gray-600">
                                <Link to="/login" className="text-blue-600 hover:underline">Về trang đăng nhập</Link>
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-1">
                                <Label htmlFor="fullName">Họ và tên</Label>
                                <Input id="fullName" placeholder="Nguyễn Văn A" {...register('fullName')} />
                                {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="password">Mật khẩu</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Tối thiểu 8 ký tự"
                                        {...register('password')}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        onClick={() => setShowPassword(v => !v)}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirm ? 'text' : 'password'}
                                        placeholder="Nhập lại mật khẩu"
                                        {...register('confirmPassword')}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        onClick={() => setShowConfirm(v => !v)}
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
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
                                {isSubmitting ? 'Đang đăng ký...' : 'Tạo tài khoản'}
                            </Button>

                            <p className="text-center text-sm text-gray-600">
                                Đã có tài khoản?{' '}
                                <Link to="/login" className="text-blue-600 hover:underline">Đăng nhập</Link>
                            </p>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
