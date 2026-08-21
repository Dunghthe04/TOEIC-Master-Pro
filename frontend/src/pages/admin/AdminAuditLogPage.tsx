/**
 * Nhật ký hành động — /admin/audit-logs. Chỉ Admin. (HM-4)
 *
 * VÌ SAO TRANG NÀY TỒN TẠI: bảng AuditLogs đã ghi 17 loại sự kiện kèm IP từ trước, nhưng
 * không có chỗ nào đọc được. Log không ai đọc được thì bằng không có log — đúng vấn đề mà
 * bảng này được sinh ra để giải (trước đó chỉ có Serilog ghi ra file).
 *
 * HAI TAB vì hai nhóm log trả lời hai câu hỏi khác nhau, và có thời gian giữ khác nhau:
 *   · Bảo mật     — "ai đang cố vào tài khoản này?"  Sinh mỗi lần login, giữ 30 ngày
 *                   (AuditLogCleanupJob dọn lúc 03:00).
 *   · Quản trị    — "ai đã nâng người này lên Admin?"  Ít bản ghi, giữ MÃI MÃI.
 *
 * KHÔNG có nút sửa/xoá, và là CỐ Ý: audit log phải append-only. Sửa được thì nó không còn
 * là bằng chứng. Dọn log cũ do job theo lịch làm, không qua UI.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2, RotateCw, Search, ShieldAlert, UserCog, X } from 'lucide-react'
import { AdminService } from '@/services/admin.service'
import type { AuditCategory, AuditLogItem } from '@/types/admin.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const PAGE_SIZE = 50

/**
 * Nhãn tiếng Việt cho từng Action. Thiếu key nào thì hiện thẳng chuỗi gốc (vd
 * "auth.login.failed") thay vì rỗng — thêm AuditActions mới ở backend mà quên map ở đây
 * thì vẫn đọc được, chỉ là chưa đẹp.
 */
const ACTION_LABELS: Record<string, string> = {
    'auth.register': 'Đăng ký tài khoản',
    'auth.login.succeeded': 'Đăng nhập thành công',
    'auth.login.failed': 'Đăng nhập thất bại',
    'auth.login.lockedout': 'Bị khoá do sai mật khẩu nhiều lần',
    'auth.login.not_confirmed': 'Chặn: email chưa xác thực',
    'auth.login.google': 'Đăng nhập bằng Google',
    'auth.password.reset_requested': 'Yêu cầu đặt lại mật khẩu',
    'auth.password.reset_completed': 'Đã đặt lại mật khẩu',
    'auth.email.confirmed': 'Xác thực email',
    'auth.token.reused': 'Refresh token bị dùng lại',
    'admin.user.created': 'Admin tạo tài khoản',
    'admin.user.roles_updated': 'Admin đổi vai',
    'admin.user.locked': 'Admin khoá tài khoản',
    'admin.user.unlocked': 'Admin mở khoá tài khoản',
    'admin.user.password_reset_sent': 'Admin gửi mail đặt lại mật khẩu',
    'admin.user.email_confirmed': 'Admin xác thực email hộ',
}

/**
 * Ba mức nổi bật. Chỉ tô đỏ thứ CẦN nhìn ngay: token bị dùng lại (dấu hiệu bị đánh cắp)
 * và bị khoá do dò mật khẩu. Tô đỏ cả "đăng nhập thất bại" thì bảng đỏ rực vì gõ sai mật
 * khẩu là chuyện thường ngày — đỏ khắp nơi thì không còn là cảnh báo.
 */
const ACTION_STYLES: Record<string, string> = {
    'auth.token.reused': 'bg-red-100 text-red-700',
    'auth.login.lockedout': 'bg-red-100 text-red-700',
    'auth.login.failed': 'bg-amber-100 text-amber-700',
    'auth.login.not_confirmed': 'bg-amber-100 text-amber-700',
}

function actionLabel(action: string) {
    return ACTION_LABELS[action] ?? action
}

/**
 * Loopback = request đến từ CHÍNH máy chạy server.
 *   "::1"       IPv6 loopback (Windows phân giải localhost ra cái này TRƯỚC 127.0.0.1)
 *   "127.0.0.1" IPv4 loopback
 *
 * Ở dev thì bình thường — mình mở trình duyệt trên cùng máy.
 *
 * ⚠️ Nhưng trên PRODUCTION đây là DẤU HIỆU HỎNG: sau Nginx, mọi request phải mang IP
 * thật lấy từ X-Forwarded-For (UseForwardedHeaders, Day 51). Thấy loopback nghĩa là
 * cấu hình đó không còn tác dụng → CẢ CỘT IP thành vô dụng vì dòng nào cũng là IP của
 * Nginx. Và nó hỏng âm thầm: không exception, không log lỗi, cột vẫn trông có dữ liệu.
 * Nên đánh dấu để nhìn là thấy, thay vì hiện trơn rồi tin nhầm.
 */
const LOOPBACK_IPS = new Set(['::1', '127.0.0.1'])

function actionStyle(action: string) {
    return ACTION_STYLES[action] ?? 'bg-gray-100 text-gray-700'
}

/**
 * CreatedAt là mốc UTC (backend lưu DateTime.UtcNow). Chuỗi ISO từ .NET có thể KHÔNG có
 * hậu tố "Z" — khi đó `new Date()` hiểu là giờ ĐỊA PHƯƠNG và mọi mốc lệch đúng 7 tiếng.
 * Thêm "Z" nếu thiếu để luôn hiểu là UTC, rồi mới đổi sang giờ máy để hiển thị.
 */
function toUtcDate(iso: string): Date {
    const hasZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso)
    return new Date(hasZone ? iso : `${iso}Z`)
}

function formatDateTime(iso: string): string {
    return toUtcDate(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
}

/**
 * Ngày (yyyy-MM-dd) người dùng chọn → mốc UTC để gửi lên server.
 * `endOfDay` cho ô "đến ngày": chọn 21/08 là muốn CẢ ngày 21, không phải 00:00 ngày 21.
 * `new Date('2026-08-21')` bị parse là UTC midnight nên phải dựng từ số để lấy đúng
 * nửa đêm THEO GIỜ MÁY, rồi toISOString() tự quy về UTC.
 */
function localDateToUtcIso(date: string, endOfDay: boolean): string | undefined {
    if (!date) return undefined
    const [y, m, d] = date.split('-').map(Number)
    if (!y || !m || !d) return undefined
    return endOfDay
        ? new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
        : new Date(y, m - 1, d, 0, 0, 0, 0).toISOString()
}

const TABS: { key: AuditCategory; label: string; hint: string; icon: typeof ShieldAlert }[] = [
    {
        key: 'Security',
        label: 'Bảo mật',
        hint: 'Đăng nhập, đăng ký, đổi mật khẩu, token bị dùng lại. Giữ 30 ngày.',
        icon: ShieldAlert,
    },
    {
        key: 'Administrative',
        label: 'Quản trị',
        hint: 'Tạo/khoá/mở tài khoản, đổi vai. Giữ vĩnh viễn để truy trách nhiệm.',
        icon: UserCog,
    },
]

export default function AdminAuditLogPage() {
    const [category, setCategory] = useState<AuditCategory>('Security')
    const [action, setAction] = useState('')
    const [actorEmail, setActorEmail] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')

    const [items, setItems] = useState<AuditLogItem[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [actions, setActions] = useState<string[]>([])

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await AdminService.getAuditLogs({
                category,
                action: action || undefined,
                actorEmail: actorEmail.trim() || undefined,
                from: localDateToUtcIso(fromDate, false),
                to: localDateToUtcIso(toDate, true),
                page,
                pageSize: PAGE_SIZE,
            })
            setItems(res.items)
            setTotal(res.total)
        } catch (err: any) {
            setError(err.response?.data?.error ?? 'Không tải được nhật ký.')
        } finally {
            setLoading(false)
        }
    }, [category, action, actorEmail, fromDate, toDate, page])

    useEffect(() => { load() }, [load])

    // Dropdown loại hành động phụ thuộc tab: log bảo mật và log quản trị không dùng chung
    // tập Action nào. Đổi tab mà giữ nguyên lựa chọn cũ thì bảng rỗng một cách vô lý.
    useEffect(() => {
        let alive = true
        AdminService.getAuditActions(category)
            .then(list => { if (alive) setActions(list) })
            .catch(() => { if (alive) setActions([]) })
        return () => { alive = false }
    }, [category])

    const switchTab = (key: AuditCategory) => {
        if (key === category) return
        setCategory(key)
        setAction('')
        setPage(1)
    }

    const hasFilter = useMemo(
        () => Boolean(action || actorEmail.trim() || fromDate || toDate),
        [action, actorEmail, fromDate, toDate],
    )

    const clearFilters = () => {
        setAction('')
        setActorEmail('')
        setFromDate('')
        setToDate('')
        setPage(1)
    }

    const activeTab = TABS.find(t => t.key === category)!

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Nhật ký hành động</h1>
                    <p className="mt-1 text-sm text-gray-600">{activeTab.hint}</p>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    <RotateCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                </Button>
            </div>

            {/* Tab */}
            <div className="flex gap-2 border-b border-gray-200">
                {TABS.map(tab => {
                    const Icon = tab.icon
                    const active = tab.key === category
                    return (
                        <button
                            key={tab.key}
                            onClick={() => switchTab(tab.key)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition ${
                                active
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Bộ lọc */}
            <Card>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
                    <div className="space-y-1">
                        <Label htmlFor="action">Loại hành động</Label>
                        <select
                            id="action"
                            value={action}
                            onChange={e => { setAction(e.target.value); setPage(1) }}
                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                        >
                            <option value="">Tất cả</option>
                            {actions.map(a => (
                                <option key={a} value={a}>{actionLabel(a)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="actor">Người thực hiện</Label>
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                id="actor"
                                className="pl-8"
                                placeholder="email..."
                                value={actorEmail}
                                onChange={e => setActorEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { setPage(1); load() } }}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="from">Từ ngày</Label>
                        <Input id="from" type="date" value={fromDate}
                            onChange={e => { setFromDate(e.target.value); setPage(1) }} />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="to">Đến ngày</Label>
                        <Input id="to" type="date" value={toDate}
                            onChange={e => { setToDate(e.target.value); setPage(1) }} />
                    </div>

                    {hasFilter && (
                        <div className="md:col-span-4">
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                <X className="mr-1 h-4 w-4" />
                                Bỏ lọc
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {error && (
                <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            <Card>
                <CardContent className="pt-6">
                    {loading && items.length === 0 ? (
                        <div className="flex items-center justify-center py-12 text-gray-500">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Đang tải...
                        </div>
                    ) : items.length === 0 ? (
                        <p className="py-12 text-center text-sm text-gray-500">
                            {hasFilter
                                ? 'Không có bản ghi nào khớp bộ lọc.'
                                : 'Chưa có bản ghi nào trong nhóm này.'}
                        </p>
                    ) : (
                        // overflow-x-auto: bảng 6 cột + IP không vừa màn hình hẹp, cho nó
                        // cuộn trong khung chứ không đẩy cả trang trượt ngang.
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                                        <TableHead>Hành động</TableHead>
                                        <TableHead>Người thực hiện</TableHead>
                                        <TableHead>Đối tượng</TableHead>
                                        <TableHead>Chi tiết</TableHead>
                                        <TableHead className="whitespace-nowrap">IP</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap text-xs text-gray-600">
                                                {formatDateTime(log.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${actionStyle(log.action)}`}>
                                                    {actionLabel(log.action)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.actorId ? (
                                                    <Link to={`/admin/users/${log.actorId}`}
                                                        className="text-blue-600 hover:underline">
                                                        {log.actorEmail}
                                                    </Link>
                                                ) : (
                                                    // Không có actorId = người gọi chưa đăng nhập
                                                    // (đăng nhập thất bại). Email là chuỗi họ GÕ,
                                                    // không phải tài khoản đã xác thực → không
                                                    // link sang trang chi tiết được.
                                                    <span className="text-gray-700">{log.actorEmail}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {log.targetId && log.targetType === 'User' ? (
                                                    <Link to={`/admin/users/${log.targetId}`}
                                                        className="text-blue-600 hover:underline">
                                                        {log.targetLabel}
                                                    </Link>
                                                ) : (
                                                    <span className="text-gray-700">{log.targetLabel || '—'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="max-w-xs text-xs text-gray-600">
                                                {log.detail || '—'}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap font-mono text-xs text-gray-500">
                                                {log.ipAddress ? (
                                                    LOOPBACK_IPS.has(log.ipAddress) ? (
                                                        <span
                                                            className="text-amber-600"
                                                            title="Loopback — request đến từ chính máy chạy server. Bình thường ở môi trường dev; trên production là dấu hiệu UseForwardedHeaders không còn tác dụng, cả cột IP sẽ vô dụng."
                                                        >
                                                            {log.ipAddress}
                                                            <span className="ml-1 font-sans not-italic">(cùng máy)</span>
                                                        </span>
                                                    ) : (
                                                        log.ipAddress
                                                    )
                                                ) : '—'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                        {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total} bản ghi
                    </span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => p - 1)}>
                            Trước
                        </Button>
                        <span className="text-xs text-gray-500">Trang {page}/{totalPages}</span>
                        <Button variant="outline" size="sm"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(p => p + 1)}>
                            Sau
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
