/**
 * Theo dõi hoạt động — /admin/monitor. Chỉ Admin, chỉ xem.
 *
 * Hiện các phiên thi ĐANG diễn ra và các phiên TREO (quá N giờ chưa nộp).
 *
 * VÌ SAO KHÔNG PHẢI "LOG": đây là TRẠNG THÁI hiện tại, không phải sự kiện đã xảy ra —
 * đọc thẳng từ TestSessions với Status = InProgress. Ghi thêm bảng log cho việc này là
 * tạo nguồn sự thật thứ hai rồi phải đồng bộ hai bên. (Nhật ký hành động quản trị và
 * nhật ký đăng nhập là chuyện khác, cần bảng riêng — làm ở lượt sau.)
 *
 * PHIÊN TREO là phần đáng giá nhất ở đây: học viên mất mạng giữa bài, đóng tab, hoặc
 * gặp lỗi — đúng loại việc họ gọi lên khiếu nại, mà trước giờ Admin không thấy được.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    AlertTriangle, Clock, Loader2, PlayCircle, RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { AdminService } from '@/services/admin.service'
import type { AdminActiveSessionsResponse } from '@/types/admin.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

/** Tự làm mới sau 30 giây — đủ để thấy thay đổi mà không dội request lên server */
const AUTO_REFRESH_MS = 30_000

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit',
        hour: '2-digit', minute: '2-digit',
    })
}

/** Khoảng thời gian từ mốc đến giờ, dạng "2 giờ 15 phút" */
function elapsed(iso: string): string {
    const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
    if (mins < 60) return `${mins} phút`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`
}

export default function AdminMonitorPage() {
    const [data, setData] = useState<AdminActiveSessionsResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    /** Mốc lần tải gần nhất — để hiện "cập nhật lúc …" cho biết dữ liệu còn mới không */
    const [lastLoaded, setLastLoaded] = useState<Date | null>(null)
    /** Ngưỡng coi một phiên là "treo". Cho đổi được vì mặc định 4 giờ thì không ai
     *  kiểm được phần này lúc test — phải ngồi đợi 4 tiếng. */
    const [staleHours, setStaleHours] = useState(4)

    const load = useCallback(async (silent = false) => {
        if (silent) setRefreshing(true)
        try {
            const res = await AdminService.getActiveSessions(staleHours)
            setData(res)
            setLastLoaded(new Date())
        } catch (err: any) {
            // Auto-refresh lỗi thì KHÔNG toast: nó chạy mỗi 30 giây, lỗi mạng tạm thời
            // sẽ dội một chuỗi toast đè lên nhau. Chỉ báo khi người dùng tự bấm.
            if (!silent) {
                toast.error(err?.response?.data?.error ?? 'Không tải được danh sách phiên thi.')
            }
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [staleHours])

    // load thay đổi khi staleHours đổi → tự nạp lại với ngưỡng mới
    useEffect(() => { load() }, [load])

    // Tự làm mới định kỳ. Dừng khi tab bị ẩn: trang mở nền cả ngày mà vẫn gọi API mỗi
    // 30 giây là tải vô ích lên server.
    useEffect(() => {
        const tick = () => {
            if (document.visibilityState === 'visible') load(true)
        }
        const timer = setInterval(tick, AUTO_REFRESH_MS)
        return () => clearInterval(timer)
    }, [load])

    const active = data?.sessions.filter(s => !s.isStale) ?? []
    const stale = data?.sessions.filter(s => s.isStale) ?? []

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Theo dõi hoạt động</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Phiên thi đang diễn ra và phiên bị bỏ dở. Tự làm mới mỗi 30 giây.
                        {lastLoaded && (
                            <> Cập nhật lúc {lastLoaded.toLocaleTimeString('vi-VN')}.</>
                        )}
                    </p>
                </div>
                <div className="flex items-end gap-2">
                    <div className="space-y-1">
                        <label htmlFor="stale" className="block text-xs text-gray-500">
                            Coi là treo sau
                        </label>
                        <select
                            id="stale"
                            value={staleHours}
                            onChange={e => setStaleHours(Number(e.target.value))}
                            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                        >
                            <option value={1}>1 giờ</option>
                            <option value={2}>2 giờ</option>
                            <option value={4}>4 giờ</option>
                            <option value={12}>12 giờ</option>
                            <option value={24}>24 giờ</option>
                        </select>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => load()} disabled={loading || refreshing}
                        className="h-9 gap-2">
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Làm mới
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                    <CardContent className="flex items-center gap-4 pt-6">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-green-100 text-green-600">
                            <PlayCircle size={20} />
                        </span>
                        <div>
                            <p className="text-xs text-gray-500">Đang làm bài</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {loading ? '…' : data?.activeCount ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 pt-6">
                        <span className="grid h-11 w-11 place-items-center rounded-lg bg-amber-100 text-amber-600">
                            <AlertTriangle size={20} />
                        </span>
                        <div>
                            <p className="text-xs text-gray-500">
                                Bị treo (quá {data?.staleHours ?? 4} giờ chưa nộp)
                            </p>
                            <p className="text-2xl font-bold text-gray-900">
                                {loading ? '…' : data?.staleCount ?? 0}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {loading ? (
                <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                    <Loader2 className="animate-spin" size={16} /> Đang tải…
                </p>
            ) : (
                <>
                    <SessionTable
                        title="Đang làm bài"
                        description="Học viên đang trong phiên thi."
                        rows={active}
                        empty="Hiện không có ai đang thi."
                    />

                    {stale.length > 0 && (
                        <SessionTable
                            title="Phiên bị treo"
                            description={`Bắt đầu quá ${data?.staleHours} giờ mà chưa nộp — thường là mất mạng giữa bài, đóng tab, hoặc gặp lỗi. Học viên vẫn tiếp tục được (bài vẫn ở trạng thái đang làm) hoặc bấm "Làm lại từ đầu" để bỏ phiên.`}
                            rows={stale}
                            empty=""
                            warn
                        />
                    )}
                </>
            )}
        </div>
    )
}

function SessionTable({ title, description, rows, empty, warn }: {
    title: string
    description: string
    rows: AdminActiveSessionsResponse['sessions']
    empty: string
    warn?: boolean
}) {
    return (
        <Card className={warn ? 'border-amber-200' : undefined}>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">
                    {title} {rows.length > 0 && <span className="text-gray-400">({rows.length})</span>}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <p className="pb-6 text-center text-sm text-gray-500">{empty}</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Học viên</TableHead>
                                    <TableHead>Đề thi</TableHead>
                                    <TableHead>Phạm vi</TableHead>
                                    <TableHead>Bắt đầu</TableHead>
                                    <TableHead>Đã làm</TableHead>
                                    <TableHead className="text-right">Đã trả lời</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map(s => (
                                    <TableRow key={s.sessionId}>
                                        <TableCell>
                                            {/* Link sang trang chi tiết để xem lịch sử thi
                                                của học viên này — thường là bước tiếp theo
                                                khi thấy một phiên treo. */}
                                            <Link to={`/admin/users/${s.userId}`}
                                                className="text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline">
                                                {s.userFullName}
                                            </Link>
                                            <p className="text-xs text-gray-500">{s.userEmail ?? '—'}</p>
                                        </TableCell>
                                        <TableCell className="text-sm">{s.testTitle}</TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {/* partsFilter là chuỗi "1,2,5" từ DB, null = full đề */}
                                            {s.partsFilter ? `Part ${s.partsFilter}` : 'Full đề'}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {formatDateTime(s.startedAt)}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <span className={`flex items-center gap-1 ${
                                                s.isStale ? 'font-medium text-amber-600' : 'text-gray-600'
                                            }`}>
                                                <Clock size={12} /> {elapsed(s.startedAt)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {s.answeredCount}
                                            {s.readingStartedAt && (
                                                <Badge variant="secondary" className="ml-2">
                                                    Đã sang Reading
                                                </Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
