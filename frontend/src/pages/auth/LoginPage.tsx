import { useState } from 'react'
//Quản lý form, lấy dữ liệu input, validate, submit, xử lý loading/error
import { useForm } from 'react-hook-form'
// Kết nối react-hook-form với Zod để validate type-safe
import { zodResolver } from '@hookform/resolvers/zod'
// Thư viện định nghĩa schema validation (luật lệ cho dữ liệu)
import { z } from 'zod'
// Link: điều hướng trong app mà không reload trang
// useNavigate: lấy hook để điều hướng programmatically
import { Link, useNavigate } from 'react-router-dom'
// Component UI từ shadcn/ui
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth.service'
//Mắt để ẩn hiện password
import { Eye, EyeOff } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '@/store/auth.store'
import { profileService } from '@/services/profile.service'
import { homeFor } from '@/lib/roles'


//Khai báo schema validate
const schema = z.object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

//tự động lấy type từ schema để dùng cho form
type LoginForm = z.infer<typeof schema>

export default function LoginPage() {
    const navigate = useNavigate();
    const [serverError, setServerError] = useState('');
    const [showPassword, setShowPassword] = useState(false)
    const loginSuccess = useAuthStore(state => state.loginSuccess)
    const setAccessToken = useAuthStore(state => state.setAccessToken)


    //Khởi tạo form có kiểu là LoginForm
    //Register là hàm ghi nhận input
    //handleSubmit là hàm xử lý submit
    //formState là state của form
    //errors là object chứa error khi validate
    //isSubmitting là true khi đang submit form
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        //Khi submit form dùng zodResolver để validate
        resolver: zodResolver(schema),
    })

    const onSubmit = async (data: LoginForm) => {
        setServerError('')
        try {
            const res = await authService.Login(data);
            // Set NGAY vào RAM — nếu để tới loginSuccess() mới set thì getMe() dưới đây
            // gọi lúc store còn chưa có token, dính 401 dư rồi phải tự refresh mới qua được.
            setAccessToken(res.accessToken)
            //Lấy thông tin user về
            const user = await profileService.getMe()
            //Lưu thông tin user vào store
            loginSuccess(res.accessToken, user)
            // Điều hướng theo VAI, không hardcode /dashboard:
            //   User → /dashboard · CM → /cm · Admin → /admin
            // Dùng biến `user` vừa lấy từ getMe(), KHÔNG đọc lại từ store —
            // store cập nhật bất đồng bộ nên đọc ngay sau loginSuccess() có thể còn giá trị cũ.
            navigate(homeFor(user), { replace: true })
        } catch (err: any) {
            // Không có response = lỗi mạng/CORS/SSL (request chưa tới API)
            const msg =
                err.response?.data?.error
                ?? (err.request && !err.response
                    ? 'Không kết nối được API. Kiểm tra backend đang chạy và VITE_BASE_URL.'
                    : 'Đăng nhập thất bại, thử lại sau.')
            setServerError(msg)
        }
    }

    //phần giao diện
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Đăng nhập</CardTitle>
                    <CardDescription>Chào mừng bạn trở lại TOEIC Master Pro</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                                    placeholder="••••••••"
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
                        <div className="text-right">
                            <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                                Quên mật khẩu?
                            </Link>
                        </div>
                        {serverError && (
                            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
                                {serverError}
                            </p>
                        )}
                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </Button>
                        <p className="text-center text-sm text-gray-600">
                            Chưa có tài khoản?{' '}
                            <Link to="/register" className="text-blue-600 hover:underline">Đăng ký ngay</Link>
                        </p>
                    </form>
                    <div className="relative my-2">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs text-gray-400">
                            <span className="bg-white px-2">hoặc</span>
                        </div>
                    </div>

                    <GoogleLogin
                        onSuccess={async (credentialResponse) => {
                            if (!credentialResponse.credential) return
                            try {
                                const res = await authService.googleLogin(credentialResponse.credential)
                                setAccessToken(res.accessToken)   // set trước getMe() — cùng lý do ở login thường
                                const user = await profileService.getMe()
                                loginSuccess(res.accessToken, user)
                                navigate(homeFor(user), { replace: true })
                            } catch {
                                setServerError('Đăng nhập Google thất bại.')
                            }
                        }}
                        onError={() => setServerError('Đăng nhập Google thất bại.')}
                        width="368"
                    />
                </CardContent>
            </Card>
        </div>
    )
}