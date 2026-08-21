/**
 * Chi tiết một tài khoản — /admin/users/:id. Chỉ Admin, chỉ xem.
 *
 * VÌ SAO CẦN: bảng Quản lý tài khoản chỉ cho biết "có 7 lượt thi", không xem được bên
 * trong. Học viên báo "điểm của tôi bị sai" hoặc "bài thi hôm qua không lưu" thì Admin
 * không có cách nào kiểm — phải vào SQL truy tay.
 *
 * Số liệu lấy từ GET /api/admin/users/{id}, endpoint đó TÁI DÙNG ITestSessionService
 * (cùng logic tính điểm với dashboard học viên) nên con số ở đây và con số học viên tự
 * thấy luôn khớp nhau. Không dựng bản tính thứ hai — hai bản song song là chắc chắn sẽ
 * lệch, và lúc đó không biết bản nào đúng.
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
    ArrowLeft, Ban, CheckCircle2, Flame, Loader2, Target, Trophy, Zap,
} from 'lucide-react'
import {
    CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { AdminService } from '@/services/admin.service'
import type { AdminUserDetail } from '@/types/admin.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

const ROLE_LABELS: Record<string, string> = {
    User: 'Học viên',
    ContentManager: 'Quản lý nội dung',
    Admin: 'Quản trị viên',
}

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('vi-VN')
}

function formatDateTime(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    })
}

/** '2026-08-21T…' → '21/08' cho trục X biểu đồ */
function shortDate(iso: string): string {
    const d = new Date(iso)
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AdminUserDetailPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [data, setData] = useState<AdminUserDetail | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return
        let cancelled = false
        AdminService.getUserDetail(id)
            .then(d => { if (!cancelled) setData(d) })
            .catch((err: any) => {
                if (cancelled) return
                toast.error(err?.response?.data?.error ?? 'Không tải được thông tin tài khoản.')
                navigate('/admin/users', { replace: true })
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [id, navigate])

    if (loading) {
        return (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                <Loader2 className="animate-spin" size={16} /> Đang tải…
            </p>
        )
    }
    if (!data) return null

    const { profile, overview, parts, timeline, history } = data

    // Chuỗi điểm cho line chart. Bỏ phiên chưa có totalScore (phiên bỏ dở) — vẽ điểm
    // null làm đường đứt đoạn trông như dữ liệu bị mất.
    const chartData = (timeline?.items ?? [])
        .filter(t => t.totalScore !== null)
        .map(t => ({ label: shortDate(t.completedAt), score: t.totalScore as number }))

    return (
        <div className="space-y-6">
            <Button variant="ghost" size="sm" asChild className="gap-2 text-gray-600">
                <Link to="/admin/users">
                    <ArrowLeft size={15} /> Quản lý tài khoản
                </Link>
            </Button>

            {/* ── Hồ sơ ──────────────────────────────────────────────── */}
            <Card>
                <CardContent className="flex flex-col gap-5 pt-6 sm:flex-row sm:items-center">
                    {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt=""
                            className="h-20 w-20 shrink-0 rounded-full object-cover" />
                    ) : (
                        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-blue-600 text-2xl font-semibold text-white">
                            {profile.fullName?.[0]?.toUpperCase() ?? '?'}
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-bold text-gray-900">{profile.fullName}</h1>
                            {profile.isLockedOut ? (
                                <Badge className="gap-1 bg-red-100 text-red-700">
                                    <Ban size={11} /> Đang khoá
                                </Badge>
                            ) : (
                                <Badge className="gap-1 bg-green-100 text-green-700">
                                    <CheckCircle2 size={11} /> Hoạt động
                                </Badge>
                            )}
                            {!profile.emailConfirmed && (
                                <Badge className="bg-amber-100 text-amber-700">Chưa xác thực email</Badge>
                            )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-500">{profile.email}</p>

                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                            <span className="flex items-center gap-1.5">
                                <Zap size={14} className="text-amber-500" /><b>{profile.xpPoints}</b> XP
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Flame size={14} className="text-orange-500" /><b>{profile.streakDays}</b> ngày streak
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Target size={14} className="text-blue-600" />Mục tiêu <b>{profile.targetScore}</b>
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Trophy size={14} className="text-purple-600" />Gói <b>{profile.plan}</b>
                            </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1">
                            {profile.roles.map(r => (
                                <Badge key={r} variant="secondary">{ROLE_LABELS[r] ?? r}</Badge>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── Thông tin phụ ─────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MiniStat label="Ngày tạo tài khoản" value={formatDate(profile.createdAt)} />
                <MiniStat label="Ngày dự thi" value={formatDate(profile.examDate)} />
                <MiniStat label="Học lần cuối" value={formatDate(profile.lastStudyDate)} />
                <MiniStat
                    label="Số lần sai mật khẩu"
                    value={String(profile.accessFailedCount)}
                    // Nêu ra khi khác 0: đây là dấu hiệu đáng để mắt (có thể là dò mật
                    // khẩu), và cũng giải thích vì sao tài khoản bị khoá.
                    hint={profile.accessFailedCount > 0 ? 'Bị khoá tạm khi chạm 5 lần' : undefined}
                />
            </div>

            {/* ── Thống kê thi ──────────────────────────────────────── */}
            {overview === null || overview.totalAttempts === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-gray-500">
                        Tài khoản này chưa hoàn thành lượt thi nào.
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <MiniStat label="Số lượt thi" value={String(overview.totalAttempts)}
                            hint={`${overview.distinctTests} đề khác nhau`} />
                        <MiniStat label="Điểm cao nhất" value={overview.bestTotalScore?.toString() ?? '—'} />
                        <MiniStat label="Điểm gần nhất" value={overview.latestTotalScore?.toString() ?? '—'} />
                        <MiniStat label="Điểm trung bình"
                            value={overview.averageTotalScore?.toFixed(1) ?? '—'}
                            hint={`Thi lần cuối ${formatDate(overview.lastCompletedAt)}`} />
                    </div>

                    {chartData.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    Điểm theo thời gian
                                </CardTitle>
                                <CardDescription>
                                    Đường ngang là điểm mục tiêu học viên tự đặt ({overview.targetScore}).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={240}>
                                    <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            interval="preserveStartEnd" minTickGap={24} />
                                        {/* domain cố định 0–990: để recharts tự chọn thì hai
                                            học viên có thang trục khác nhau, nhìn tưởng ngang nhau */}
                                        <YAxis domain={[0, 990]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                            formatter={(v: number) => [`${v} điểm`, 'Tổng điểm']} />
                                        <ReferenceLine y={overview.targetScore} stroke="#f97316"
                                            strokeDasharray="4 4" />
                                        <Line type="monotone" dataKey="score" stroke="#2563eb"
                                            strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

                    {parts && parts.parts.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    Độ chính xác theo Part
                                </CardTitle>
                                <CardDescription>
                                    Gom từ {parts.sessionsAnalyzed} lượt thi.
                                    {parts.weakestParts.length > 0 && (
                                        <> Yếu nhất: Part {parts.weakestParts.join(', ')}.</>
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {parts.parts.map(p => (
                                    <div key={p.part}>
                                        <div className="mb-1 flex justify-between text-xs">
                                            <span className="font-medium text-gray-700">Part {p.part}</span>
                                            <span className="text-gray-500">
                                                {p.correct}/{p.total} ({p.accuracyPercent.toFixed(0)}%)
                                            </span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                                            <div
                                                className={`h-full rounded-full ${
                                                    p.accuracyPercent >= 80 ? 'bg-green-500'
                                                    : p.accuracyPercent >= 50 ? 'bg-amber-500'
                                                    : 'bg-red-500'
                                                }`}
                                                style={{ width: `${p.accuracyPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {history && history.items.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-medium text-gray-500">
                                    Lịch sử thi
                                </CardTitle>
                                <CardDescription>
                                    {history.total} lượt thi
                                    {history.total > history.items.length && (
                                        <> — hiện {history.items.length} lượt gần nhất</>
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Đề thi</TableHead>
                                                <TableHead>Phạm vi</TableHead>
                                                <TableHead className="text-right">Listening</TableHead>
                                                <TableHead className="text-right">Reading</TableHead>
                                                <TableHead className="text-right">Tổng</TableHead>
                                                <TableHead className="text-right">Đúng</TableHead>
                                                <TableHead>Nộp lúc</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.items.map(h => (
                                                <TableRow key={h.sessionId}>
                                                    <TableCell className="text-sm font-medium text-gray-900">
                                                        {h.testTitle}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-gray-500">
                                                        {/* partsFilter null = thi full đề. Phải phân biệt,
                                                            không thì 350 điểm của bài 2 part trông như
                                                            điểm thấp của bài full. */}
                                                        {h.partsFilter?.length
                                                            ? `Part ${h.partsFilter.join(', ')}`
                                                            : 'Full đề'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {h.listeningScore ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm">
                                                        {h.readingScore ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm font-semibold">
                                                        {h.totalScore ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right text-sm text-gray-500">
                                                        {h.correctCount}/{h.totalCount}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-gray-500">
                                                        {formatDateTime(h.completedAt)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
                {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
            </CardContent>
        </Card>
    )
}
