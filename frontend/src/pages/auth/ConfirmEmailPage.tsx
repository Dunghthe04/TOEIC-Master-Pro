import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { authService } from '@/services/auth.service'

type Status = 'loading' | 'success' | 'error'

// Đích của link trong email xác nhận (AuthService.RegisterAsync) — đọc userId/token
// từ query string rồi gọi thẳng GET /auth/confirm-email, không cần user tự thao tác gì.
export default function ConfirmEmailPage() {
    const [searchParams] = useSearchParams()
    const [status, setStatus] = useState<Status>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const userId = searchParams.get('userId')
        const token = searchParams.get('token')

        if (!userId || !token) {
            setStatus('error')
            setMessage('Link xác nhận không hợp lệ — thiếu userId hoặc token.')
            return
        }

        authService.confirmEmail(userId, token)
            .then((res) => {
                setStatus('success')
                setMessage(res.message)
            })
            .catch((err) => {
                setStatus('error')
                setMessage(err.response?.data?.error ?? 'Xác nhận email thất bại.')
            })
    }, [searchParams])

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Xác nhận email</CardTitle>
                    {status === 'loading' && (
                        <CardDescription>Đang xác nhận tài khoản...</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    {status === 'success' && (
                        <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                            {message}
                        </p>
                    )}
                    {status === 'error' && (
                        <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                            {message}
                        </p>
                    )}
                    {status !== 'loading' && (
                        <Link to="/" className="text-sm text-blue-600 hover:underline">
                            Về trang chủ để đăng nhập
                        </Link>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
