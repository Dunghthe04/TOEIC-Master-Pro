import { useEffect, useState } from 'react'
import { ExamScheduleService } from '@/services/exam-schedule.service'
import type { ExamSchedule } from '@/types/exam-schedule.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Calendar, MapPin, Building2, ExternalLink, Bell, BellRing, Clock } from 'lucide-react'
import { toast } from 'sonner'

// Danh sách tỉnh hay thi — phải khớp CHÍNH XÁC chữ City lưu trong DB.
// "TP Hồ Chí Minh" (không viết tắt "TP.HCM") vì đó là chuỗi IIG trả về trong field "area",
// được lưu thẳng vào City lúc sync (IigExamScheduleSyncService.UpsertAsync) — filter so khớp
// tuyệt đối (e.City == city) nên lệch 1 ký tự là ra danh sách rỗng, không lỗi rõ ràng gì cả.
const CITIES = [
    'Hà Nội',
    'TP Hồ Chí Minh',
    'Đà Nẵng',
    'Hải Phòng',
    'Cần Thơ',
]

// Fallback khi lịch (nguồn IIG) không có registerUrl riêng — trang đăng ký thi chung của IIG
const IIG_REGISTER_URL =
    'https://online.iigvietnam.com/vi/test-registration?exam=TOEIC-OL&type=1&_gl=1*sqvxsw*_gcl_au*OTU4NDgyMTU1LjE3ODQ0MzI2MTA.'

// Class chung cho mọi SelectTrigger trên trang này — to hơn mặc định (h-8) cho dễ bấm/dễ đọc
const FILTER_TRIGGER_CLASS = 'h-11 rounded-xl text-sm px-4 shadow-sm'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = [2025, 2026, 2027]

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('vi-VN')
}

function formatFee(fee: number) {
    return fee.toLocaleString('vi-VN') + 'đ'
}

// Cắt "08:30:00" → "08:30"
function formatTime(time: string) {
    return time.slice(0, 5)
}

function formatUpdatedAt(d: Date) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function ExamSchedulePage() {
    const [items, setItems] = useState<ExamSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [city, setCity] = useState('all')
    const [month, setMonth] = useState('all')
    const [year, setYear] = useState(String(new Date().getFullYear()))
    // Tập id đã subscribe — chuông đỏ + rung
    const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set())
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const [examTitle, setExamTitle] = useState('all')
    const [officeLocation, setOfficeLocation] = useState('all')
    const [status, setStatus] = useState('open')   // 'open' | 'closed' | 'all'
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null)


    const load = async () => {
        setLoading(true)
        try {
            const data = await ExamScheduleService.getList({
                city: city !== 'all' ? city : undefined,
                month: month !== 'all' ? Number(month) : undefined,
                year: year !== 'all' ? Number(year) : undefined,
                isActive: status === 'all' ? undefined : status === 'open',   // đổi: bỏ hardcode true
                title: examTitle !== 'all' ? examTitle : undefined,            // MỚI
                location: officeLocation !== 'all' ? officeLocation : undefined, // MỚI
            })
            setItems(data)
            setLastUpdated(new Date())

            // Load trạng thái chuông (cần đã login)
            try {
                const ids = await ExamScheduleService.getMyReminders()
                setRemindedIds(new Set(ids))
            } catch {
                // Chưa login / 401 → coi như chưa nhắc nào
                setRemindedIds(new Set())
            }
        } catch {
            toast.error('Không tải được lịch thi')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        const interval = setInterval(load, 60_000)   // mỗi 1 phút gọi lại /api/examschedule
        return () => clearInterval(interval)          // dọn interval cũ khi đổi filter/unmount
    }, [city, month, year, examTitle, officeLocation, status])

    const openRegister = (url: string | null) => {
        if (!url) {
            toast.error('Kỳ thi này chưa có link đăng ký')
            return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    // Toggle: chưa nhắc → subscribe; đã nhắc → unsubscribe
    const handleToggleReminder = async (id: string) => {
        const subscribed = remindedIds.has(id)
        setTogglingId(id)
        try {
            if (subscribed) {
                await ExamScheduleService.unsubscribeReminder(id)
                setRemindedIds(prev => {
                    const next = new Set(prev)
                    next.delete(id)
                    return next
                })
                toast.success('Đã hủy nhắc email')
            } else {
                await ExamScheduleService.subscribeReminder(id)
                setRemindedIds(prev => new Set(prev).add(id))
                toast.success('Đã đặt nhắc email (~3 ngày trước ngày thi)')
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error ?? (subscribed ? 'Không hủy được nhắc' : 'Không đặt được nhắc'))
        } finally {
            setTogglingId(null)
        }
    }

    const examTitles = Array.from(new Set(items.map(i => i.title))).sort()
    const officeLocations = Array.from(new Set(items.map(i => i.location))).sort()
    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Lịch thi TOEIC</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Xem lịch thi IIG / BC do hệ thống cập nhật. Đăng ký thi thật trên trang tổ chức.
                </p>
                {lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Cập nhật gần nhất: {formatUpdatedAt(lastUpdated)}
                    </p>
                )}
            </div>

            {/* Bộ lọc — giá trị "all" = không gửi param lên API */}
            <div className="flex flex-wrap gap-3 rounded-2xl border bg-muted/30 p-4">
                <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className={`w-44 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Tỉnh/TP" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả tỉnh</SelectItem>
                        {CITIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className={`w-36 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Tháng" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả tháng</SelectItem>
                        {MONTHS.map(m => (
                            <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className={`w-32 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Năm" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả năm</SelectItem>
                        {YEARS.map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={examTitle} onValueChange={setExamTitle}>
                    <SelectTrigger className={`w-64 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Bài thi" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả bài thi</SelectItem>
                        {examTitles.map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={officeLocation} onValueChange={setOfficeLocation}>
                    <SelectTrigger className={`w-56 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Địa điểm" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả địa điểm</SelectItem>
                        {officeLocations.map(l => (
                            <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className={`w-36 ${FILTER_TRIGGER_CLASS}`}><SelectValue placeholder="Trạng thái" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">Đang mở</SelectItem>
                        <SelectItem value="closed">Đã đóng</SelectItem>
                        <SelectItem value="all">Tất cả</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <p className="text-muted-foreground">Đang tải...</p>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground">Không có lịch thi phù hợp.</p>
            ) : (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => {
                        const isReminded = remindedIds.has(item.id)
                        // Bản ghi IIG (sync tự động) không có registerUrl riêng → dùng trang đăng ký chung của IIG
                        const registerHref = item.registerUrl ?? (item.organizer === 'IIG' ? IIG_REGISTER_URL : null)
                        return (
                            <Card
                                key={item.id}
                                className="rounded-2xl border-muted-foreground/10 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                <CardHeader>
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-lg leading-snug">{item.title}</CardTitle>
                                        <Badge className="shrink-0 bg-blue-600 text-white hover:bg-blue-600">{item.organizer}</Badge>
                                    </div>
                                    <CardDescription className="flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                                        {item.location}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-2.5 text-sm">
                                    <p className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 shrink-0 text-blue-500" />
                                        {item.city}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 shrink-0 text-blue-500" />
                                        {formatDate(item.examDate)}
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 shrink-0 text-blue-500" />
                                        {formatTime(item.startTime)}
                                        {item.endTime && ` - ${formatTime(item.endTime)}`}
                                    </p>
                                    {item.registrationDeadline && (
                                        <p>Hạn ĐK: <strong>{formatDate(item.registrationDeadline)}</strong></p>
                                    )}
                                    {item.fee != null && (
                                        <p>Phí: <strong>{formatFee(item.fee)}</strong></p>
                                    )}
                                    {item.resultDate && (
                                        <p>Ngày trả kết quả: <strong>{formatDate(item.resultDate)}</strong></p>
                                    )}
                                    {item.availableSlots != null && (
                                        <p>Chỗ còn: {item.availableSlots}</p>
                                    )}
                                </CardContent>

                                <CardFooter className="flex gap-2">
                                    <Button
                                        className="flex-1 rounded-xl"
                                        disabled={!registerHref}
                                        onClick={() => openRegister(registerHref)}
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Đăng ký
                                    </Button>
                                    <Button
                                        variant="outline"
                                        disabled={togglingId === item.id}
                                        title={isReminded ? 'Bấm để hủy nhắc email' : 'Đặt nhắc email trước ngày thi'}
                                        onClick={() => handleToggleReminder(item.id)}
                                        className={`rounded-xl ${isReminded
                                            ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700'
                                            : 'text-muted-foreground'}`}
                                    >
                                        {isReminded ? (
                                            <BellRing className="w-4 h-4 animate-bell-ring" />
                                        ) : (
                                            <Bell className="w-4 h-4" />
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
