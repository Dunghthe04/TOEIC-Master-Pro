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
import { Calendar, MapPin, Building2, ExternalLink, Bell } from 'lucide-react'
import { toast } from 'sonner'

// Danh sách tỉnh hay thi — phải khớp chữ City mà CM nhập khi tạo lịch
const CITIES = [
    'Hà Nội',
    'TP.HCM',
    'Đà Nẵng',
    'Hải Phòng',
    'Cần Thơ',
]

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

export default function ExamSchedulePage() {
    const [items, setItems] = useState<ExamSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [city, setCity] = useState('all')
    const [month, setMonth] = useState('all')
    const [year, setYear] = useState(String(new Date().getFullYear()))

    const load = async () => {
        setLoading(true)
        try {
            const data = await ExamScheduleService.getList({
                city: city !== 'all' ? city : undefined,
                month: month !== 'all' ? Number(month) : undefined,
                year: year !== 'all' ? Number(year) : undefined,
                isActive: true,
            })
            setItems(data)
        } catch {
            toast.error('Không tải được lịch thi')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [city, month, year])

    const openRegister = (url: string | null) => {
        if (!url) {
            toast.error('Kỳ thi này chưa có link đăng ký')
            return
        }
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Lịch thi TOEIC</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Xem lịch thi IIG / BC do hệ thống cập nhật. Đăng ký thi thật trên trang tổ chức.
                </p>
            </div>

            {/* Bộ lọc — giá trị "all" = không gửi param lên API */}
            <div className="flex flex-wrap gap-3">
                <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Tỉnh/TP" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả tỉnh</SelectItem>
                        {CITIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-36"><SelectValue placeholder="Tháng" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả tháng</SelectItem>
                        {MONTHS.map(m => (
                            <SelectItem key={m} value={String(m)}>Tháng {m}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-32"><SelectValue placeholder="Năm" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tất cả năm</SelectItem>
                        {YEARS.map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <p className="text-muted-foreground">Đang tải...</p>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground">Không có lịch thi phù hợp.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map(item => (
                        <Card key={item.id}>
                            <CardHeader>
                                <div className="flex items-start justify-between gap-2">
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                    <Badge variant="secondary">{item.organizer}</Badge>
                                </div>
                                <CardDescription className="flex items-center gap-1">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {item.location}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-2 text-sm">
                                <p className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    {item.city}
                                </p>
                                <p className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    {formatDate(item.examDate)} · {formatTime(item.startTime)}
                                </p>
                                <p>
                                    Hạn ĐK: <strong>{formatDate(item.registrationDeadline)}</strong>
                                </p>
                                <p>
                                    Phí: <strong>{formatFee(item.fee)}</strong>
                                </p>
                                {item.availableSlots != null && (
                                    <p>Chỗ còn: {item.availableSlots}</p>
                                )}
                            </CardContent>

                            <CardFooter className="flex gap-2">
                                <Button
                                    className="flex-1"
                                    disabled={!item.registerUrl}
                                    onClick={() => openRegister(item.registerUrl)}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Đăng ký
                                </Button>
                                {/* Day 21: gắn API nhắc email */}
                                <Button variant="outline" disabled title="Sẽ làm ở Day 21">
                                    <Bell className="w-4 h-4" />
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}