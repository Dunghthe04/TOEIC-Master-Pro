/**
 * Popup đăng nhập / đăng ký — hiện ngay trên landing page, KHÔNG rời trang.
 *
 * VÌ SAO POPUP thay vì chuyển sang /login: khách đang xem đề, bấm "Bắt đầu thi" mà bị
 * đẩy sang trang khác thì mất ngữ cảnh. Popup giữ nguyên vị trí, đăng nhập xong đi
 * thẳng tới đúng chức năng vừa bấm (prop `returnTo`).
 *
 * Không tái dùng LoginPage/RegisterPage vì chúng là TRANG full-screen có Card riêng.
 * Ở đây chỉ cần phần form.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, X } from 'lucide-react'
import { GoogleLogin } from '@react-oauth/google'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth.service'
import { profileService } from '@/services/profile.service'
import { useAuthStore } from '@/store/auth.store'
import { homeFor } from '@/lib/roles'

const loginSchema = z.object({
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})
const registerSchema = z.object({
    fullName: z.string().min(2, 'Họ tên tối thiểu 2 ký tự'),
    email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
    // Khớp Identity ở backend: RequiredLength=8, có chữ hoa + số + ký tự đặc biệt.
    // Validate ở đây để user biết ngay, không phải đợi server trả lỗi.
    password: z.string()
        .min(8, 'Mật khẩu tối thiểu 8 ký tự')
        .regex(/[A-Z]/, 'Cần ít nhất 1 chữ in hoa')
        .regex(/[0-9]/, 'Cần ít nhất 1 chữ số')
        .regex(/[^A-Za-z0-9]/, 'Cần ít nhất 1 ký tự đặc biệt'),
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

type Props = {
    open: boolean
    /** Nơi điều hướng tới sau khi đăng nhập xong — chức năng khách vừa bấm */
    returnTo: string
    onClose: () => void
}

export default function AuthDialog({ open, returnTo, onClose }: Props) {
    const [tab, setTab] = useState<'login' | 'register'>('login')

    // Esc để đóng + chặn cuộn trang phía sau khi popup mở
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Lớp phủ — bấm ra ngoài để đóng */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl
                            animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400
                               transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Đóng"
                >
                    <X size={18} />
                </button>

                {/* Tab — hai nửa, tab đang chọn nền xanh (giống các trang TOEIC quen thuộc) */}
                <div className="grid grid-cols-2">
                    {(['login', 'register'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`py-3.5 text-sm font-semibold transition-colors ${
                                tab === t
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                            }`}
                        >
                            {t === 'login' ? 'Đăng nhập' : 'Đăng ký'}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {tab === 'login'
                        ? <LoginForm returnTo={returnTo} onClose={onClose} />
                        : <RegisterForm onDone={() => setTab('login')} />}
                </div>
            </div>
        </div>
    )
}

/** Sau khi login: lưu token → lấy profile (có roles) → vào returnTo */
function LoginForm({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
    const navigate = useNavigate()
    const loginSuccess = useAuthStore(s => s.loginSuccess)
    const setAccessToken = useAuthStore(s => s.setAccessToken)
    const [serverError, setServerError] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(loginSchema),
    })

    /** Dùng chung cho login thường và Google login */
    const finish = async (accessToken: string) => {
        // KHÔNG còn saveTokens — refreshToken đã chuyển sang httpOnly cookie, server tự
        // set qua Set-Cookie header lúc login; accessToken chỉ cần đưa vào RAM (Zustand).
        // Set NGAY, trước getMe() — không thì getMe() gọi lúc store chưa có token, dính
        // 401 dư rồi phải tự refresh mới qua được (xem lại luồng Login đã mô tả).
        setAccessToken(accessToken)
        const user = await profileService.getMe()
        loginSuccess(accessToken, user)
        onClose()

        // Khách bấm "Bắt đầu thi" mà lại là tài khoản CM/Admin → returnTo là trang thi,
        // họ không có quyền (403). Đưa về trang chủ theo vai cho khỏi ăn lỗi.
        const isLearner = user.roles?.includes('User')
        navigate(isLearner ? returnTo : homeFor(user), { replace: true })
    }

    const onSubmit = async (data: LoginForm) => {
        setServerError('')
        try {
            const res = await authService.Login(data)
            await finish(res.accessToken)
        } catch (err: any) {
            setServerError(
                err.response?.data?.error
                ?? (err.request && !err.response
                    ? 'Không kết nối được server. Thử lại sau.'
                    : 'Email hoặc mật khẩu không đúng.')
            )
        }
    }

    return (
        <>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                    <Label htmlFor="dlg-email">Email</Label>
                    <Input id="dlg-email" type="email" placeholder="you@example.com" autoFocus {...register('email')} />
                    {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="dlg-pass">Mật khẩu</Label>
                    <div className="relative">
                        <Input
                            id="dlg-pass"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            {...register('password')}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
                </div>

                {serverError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">
                        {serverError}
                    </p>
                )}

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
                </Button>
            </form>

            <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs text-gray-400">
                    <span className="bg-white px-2">hoặc</span>
                </div>
            </div>

            <div className="flex justify-center">
                <GoogleLogin
                    onSuccess={async (cred) => {
                        if (!cred.credential) return
                        try {
                            const res = await authService.googleLogin(cred.credential)
                            await finish(res.accessToken)
                        } catch {
                            setServerError('Đăng nhập Google thất bại.')
                        }
                    }}
                    onError={() => setServerError('Đăng nhập Google thất bại.')}
                    width="336"
                />
            </div>
        </>
    )
}

/**
 * Đăng ký xong KHÔNG tự đăng nhập — backend yêu cầu xác thực email
 * (token in ra console ở môi trường dev). Chuyển về tab Đăng nhập kèm thông báo.
 */
function RegisterForm({ onDone }: { onDone: () => void }) {
    const [serverError, setServerError] = useState('')
    const [done, setDone] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
        resolver: zodResolver(registerSchema),
    })

    const onSubmit = async (data: RegisterForm) => {
        setServerError('')
        try {
            await authService.Register(data)
            setDone(true)
            setTimeout(onDone, 1800)   // để user đọc được thông báo rồi mới đổi tab
        } catch (err: any) {
            setServerError(err.response?.data?.error ?? 'Đăng ký thất bại, thử lại sau.')
        }
    }

    if (done) {
        return (
            <div className="py-6 text-center">
                <p className="font-semibold text-green-700">Đăng ký thành công</p>
                <p className="mt-1.5 text-sm text-gray-600">
                    Đang chuyển sang đăng nhập…
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
                <Label htmlFor="reg-name">Họ và tên</Label>
                <Input id="reg-name" placeholder="Nguyễn Văn A" autoFocus {...register('fullName')} />
                {errors.fullName && <p className="text-sm text-red-500">{errors.fullName.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" placeholder="you@example.com" {...register('email')} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
                <Label htmlFor="reg-pass">Mật khẩu</Label>
                <div className="relative">
                    <Input
                        id="reg-pass"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Tối thiểu 8 ký tự"
                        {...register('password')}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                {errors.password
                    ? <p className="text-sm text-red-500">{errors.password.message}</p>
                    : <p className="text-xs text-gray-400">Cần chữ in hoa, chữ số và ký tự đặc biệt.</p>}
            </div>

            {serverError && (
                <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">
                    {serverError}
                </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Đang tạo tài khoản…' : 'Đăng ký'}
            </Button>
        </form>
    )
}
