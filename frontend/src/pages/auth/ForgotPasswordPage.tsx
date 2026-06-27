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

//Schema validate
const schema = z.object({
    email: z.string().email('Email không hợp lệ')
})

type ForgotForm = z.infer<typeof schema>

export default function ForgotPasswordPage() {
    const [successMsg, setSuccessMsg] = useState('');
    const [serverErrorMsg, setServerErrorMsg] = useState('');

    //khởi tạo form
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotForm>({
        resolver: zodResolver(schema)
    })

    const onSubmit = async (data: ForgotForm) => {
        try {
            const res = await authService.forgotPassword(data)
            setSuccessMsg(res.message)
        } catch {
            setServerErrorMsg('Có lỗi xảy ra, thử lại sau.')
        }
    }
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl">Quên mật khẩu</CardTitle>
                    <CardDescription>Nhập email để nhận link đặt lại mật khẩu</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
                            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
                        </div>

                        {successMsg && (
                            <p className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-700">
                                {successMsg}
                            </p>
                        )}

                        {serverErrorMsg && (
                            <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600">
                                {serverErrorMsg}
                            </p>
                        )}

                        <Button type="submit" className="w-full" disabled={isSubmitting}>
                            {isSubmitting ? 'Đang gửi...' : 'Gửi link đặt lại mật khẩu'}
                        </Button>

                        <p className="text-center text-sm text-gray-600">
                            <Link to="/login" className="text-blue-600 hover:underline">Quay lại đăng nhập</Link>
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}