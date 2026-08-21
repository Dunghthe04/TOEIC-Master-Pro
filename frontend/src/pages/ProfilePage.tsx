/**
 * Trang cá nhân — xem và sửa thông tin của chính mình.
 *
 * VÌ SAO CÓ TRANG NÀY: menu "Trang cá nhân" trước đây trỏ về /dashboard (trang thống kê
 * điểm), nên bấm vào không thấy thông tin cá nhân đâu và KHÔNG có chỗ nào đặt điểm mục
 * tiêu — dù toàn bộ biểu đồ tiến độ (đường "mục tiêu" ở TestProgressPage,
 * /stats/timeline, /stats/by-test) đều vẽ theo targetScore. Trước đó giá trị đó chỉ có
 * thể là 700 mặc định từ DB, người dùng không có cách nào đổi.
 *
 * Backend đã có sẵn: GET/PUT /api/profile/me và POST /api/profile/me/avatar
 * ([Authorize] trần — cả ba vai đều xem/sửa profile của chính mình).
 */
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Camera, Flame, Loader2, Target, Trophy, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { profileService } from '@/services/profile.service'
import { useAuthStore } from '@/store/auth.store'

// Khớp UpdateProfileRequest ở backend. Validate CẢ HAI phía là cố ý, không phải lặp
// vô ích: ở đây để user biết ngay khi đang gõ, ở server vì frontend chạy trên máy người
// dùng nên không bao giờ là chốt chặn thật.
const schema = z.object({
    fullName: z.string()
        .min(2, 'Họ tên tối thiểu 2 ký tự')
        .max(100, 'Họ tên tối đa 100 ký tự'),
    targetScore: z.coerce.number()
        .int('Điểm phải là số nguyên')
        .min(10, 'Điểm mục tiêu tối thiểu 10')
        .max(990, 'Điểm mục tiêu tối đa 990')
        .refine(v => v % 5 === 0, 'Điểm TOEIC luôn là bội số của 5'),
    // input type="date" trả '' khi để trống, không phải null → chấp nhận '' rồi đổi
    // thành null lúc gửi lên.
    examDate: z.string(),
})

type ProfileForm = z.infer<typeof schema>

/** Mốc điểm hay nhắm tới — bấm một nút thay vì tự gõ số */
const SCORE_PRESETS = [450, 550, 650, 700, 800, 900]

/** Date của backend (ISO, có thể kèm giờ) → 'YYYY-MM-DD' cho input type="date" */
function toDateInput(iso: string | null): string {
    if (!iso) return ''
    // Cắt chuỗi thay vì new Date().toISOString(): qua Date là quy về UTC, ngày 01/09
    // lưu lúc 00:00 giờ VN sẽ lùi thành 31/08.
    return iso.slice(0, 10)
}

export default function ProfilePage() {
    const user = useAuthStore(s => s.user)
    const setUser = useAuthStore(s => s.setUser)

    const [loading, setLoading] = useState(true)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const { register, handleSubmit, reset, watch, setValue,
            formState: { errors, isSubmitting, isDirty } } = useForm<ProfileForm>({
        resolver: zodResolver(schema),
        defaultValues: { fullName: '', targetScore: 700, examDate: '' },
    })

    // Luôn gọi lại getMe() thay vì chỉ dùng user trong store: store được persist qua F5
    // nên có thể là dữ liệu cũ (đổi ở máy/tab khác). Trang sửa thông tin thì phải hiện
    // đúng giá trị ĐANG có trên server, không thì user vô tình ghi đè lại dữ liệu mới.
    useEffect(() => {
        let cancelled = false
        profileService.getMe()
            .then(me => {
                if (cancelled) return
                setUser(me)
                reset({
                    fullName: me.fullName,
                    targetScore: me.targetScore,
                    examDate: toDateInput(me.examDate),
                })
            })
            .catch(() => {
                if (!cancelled) toast.error('Không tải được thông tin cá nhân.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
        // reset/setUser lấy từ store & react-hook-form, ổn định giữa các lần render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onSubmit = async (data: ProfileForm) => {
        try {
            const updated = await profileService.updateMe({
                fullName: data.fullName.trim(),
                targetScore: data.targetScore,
                // '' = user xoá ngày thi → gửi null để backend ghi NULL, chứ không phải
                // chuỗi rỗng (DateTime? không parse được '' và sẽ thành 400).
                examDate: data.examDate === '' ? null : data.examDate,
            })
            setUser(updated)
            // reset lại bằng dữ liệu server trả về → isDirty về false, nút Lưu mờ lại,
            // và nếu server chuẩn hoá gì đó thì form hiện đúng giá trị đã lưu.
            reset({
                fullName: updated.fullName,
                targetScore: updated.targetScore,
                examDate: toDateInput(updated.examDate),
            })
            toast.success('Đã lưu thông tin cá nhân.')
        } catch (err: any) {
            toast.error(
                err.response?.data?.error
                ?? (err.request && !err.response
                    ? 'Không kết nối được server. Thử lại sau.'
                    : 'Không lưu được, thử lại sau.')
            )
        }
    }

    const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        // Reset input NGAY: không thì chọn lại đúng file vừa lỗi sẽ không kích onChange
        // (value không đổi) và người dùng tưởng nút bị hỏng.
        e.target.value = ''
        if (!file) return

        // Kiểm trước khi gửi để user biết ngay — server vẫn kiểm lại (ProfileController).
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Ảnh quá lớn. Tối đa 2MB.')
            return
        }
        const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            toast.error('Chỉ chấp nhận .jpg, .png, .webp.')
            return
        }

        setUploadingAvatar(true)
        try {
            const updated = await profileService.uploadAvatar(file)
            setUser(updated)
            toast.success('Đã cập nhật ảnh đại diện.')
        } catch (err: any) {
            toast.error(err.response?.data?.error ?? 'Không tải được ảnh lên.')
        } finally {
            setUploadingAvatar(false)
        }
    }

    const targetScore = watch('targetScore')

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-gray-500">
                <Loader2 className="mr-2 animate-spin" size={18} /> Đang tải…
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-3xl space-y-6 p-6">
            <div>
                <h1 className="text-2xl font-bold">Trang cá nhân</h1>
                <p className="text-sm text-gray-500">
                    Thông tin tài khoản và mục tiêu học tập của bạn.
                </p>
            </div>

            {/* ── Thẻ tổng quan: avatar + số liệu chỉ-đọc ─────────────── */}
            <Card>
                <CardContent className="flex flex-col items-center gap-5 pt-6 sm:flex-row">
                    {/* Avatar — bấm vào để đổi ảnh */}
                    <div className="relative shrink-0">
                        {user?.avatarUrl ? (
                            <img
                                src={user.avatarUrl}
                                alt="Ảnh đại diện"
                                className="h-20 w-20 rounded-full object-cover"
                            />
                        ) : (
                            <span className="grid h-20 w-20 place-items-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
                                {user?.fullName?.[0]?.toUpperCase() ?? '?'}
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full
                                       border-2 border-white bg-gray-900 text-white transition-colors
                                       hover:bg-gray-700 disabled:opacity-60"
                            aria-label="Đổi ảnh đại diện"
                        >
                            {uploadingAvatar
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Camera size={14} />}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={onPickAvatar}
                            className="hidden"
                        />
                    </div>

                    <div className="min-w-0 flex-1 text-center sm:text-left">
                        <p className="truncate text-lg font-semibold">{user?.fullName}</p>
                        {/* Email KHÔNG cho sửa: nó là danh tính đăng nhập và đã qua xác
                            thực email. Đổi được ở đây là mở đường chiếm tài khoản —
                            muốn đổi phải có luồng xác thực địa chỉ mới riêng. */}
                        <p className="truncate text-sm text-gray-500">{user?.email}</p>
                        <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm sm:justify-start">
                            <span className="flex items-center gap-1.5 text-gray-600">
                                <Zap size={15} className="text-amber-500" />
                                <b>{user?.xpPoints ?? 0}</b> XP
                            </span>
                            <span className="flex items-center gap-1.5 text-gray-600">
                                <Flame size={15} className="text-orange-500" />
                                <b>{user?.streakDays ?? 0}</b> ngày streak
                            </span>
                            <span className="flex items-center gap-1.5 text-gray-600">
                                <Trophy size={15} className="text-blue-600" />
                                Gói <b>{user?.plan ?? 'Free'}</b>
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Form sửa thông tin + mục tiêu ───────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Thông tin & mục tiêu</CardTitle>
                    <CardDescription>
                        Điểm mục tiêu là đường tham chiếu trên biểu đồ tiến độ và trong bảng điểm.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="fullName">Họ và tên</Label>
                            <Input id="fullName" placeholder="Nguyễn Văn A" {...register('fullName')} />
                            {errors.fullName && (
                                <p className="text-sm text-red-500">{errors.fullName.message}</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="targetScore" className="flex items-center gap-1.5">
                                <Target size={15} className="text-blue-600" /> Điểm mục tiêu
                            </Label>
                            <Input
                                id="targetScore"
                                type="number"
                                min={10}
                                max={990}
                                step={5}
                                {...register('targetScore')}
                            />
                            {/* Nút chọn nhanh — shouldDirty để nút Lưu bật lên, shouldValidate
                                để lỗi cũ (nếu có) biến mất ngay. */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {SCORE_PRESETS.map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setValue('targetScore', s, {
                                            shouldDirty: true, shouldValidate: true,
                                        })}
                                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                            Number(targetScore) === s
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            {errors.targetScore
                                ? <p className="text-sm text-red-500">{errors.targetScore.message}</p>
                                : <p className="text-xs text-gray-400">Từ 10 đến 990, bội số của 5.</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="examDate">Ngày dự thi</Label>
                            <Input id="examDate" type="date" {...register('examDate')} />
                            {errors.examDate
                                ? <p className="text-sm text-red-500">{errors.examDate.message}</p>
                                : <p className="text-xs text-gray-400">
                                    Để trống nếu chưa định ngày. Muốn nhận mail nhắc lịch thi
                                    thì đặt chuông ở trang Lịch thi.
                                  </p>}
                        </div>

                        {/* Vô hiệu khi chưa sửa gì — tránh gửi request rỗng và cho user
                            biết rõ là "chưa có gì để lưu". */}
                        <Button type="submit" disabled={isSubmitting || !isDirty}>
                            {isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
