/**
 * Trang chủ Admin — /admin. Chỉ XEM, không CRUD nội dung (đó là việc của CM).
 * Quản lý tài khoản nằm ở /admin/users (AdminUsersPage).
 */
import { useEffect, useState } from 'react'
import {
    Users, FileText, HelpCircle, ClipboardCheck, TrendingUp, Trophy, BarChart3,
    BookMarked, CalendarDays,
} from 'lucide-react'
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
    Tooltip, XAxis, YAxis,
} from 'recharts'
import { AdminService } from '@/services/admin.service'
import type { AdminOverview, AdminStats } from '@/types/admin.types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

/** Số ngày cho biểu đồ hoạt động — khớp khoảng backend cho phép (7–180). */
const RANGE_OPTIONS = [7, 30, 90] as const

/** '2026-08-21' → '21/08' cho trục X (nhãn ISO đầy đủ chật và khó đọc) */
function shortDate(iso: string): string {
    const [, m, d] = iso.split('-')
    return `${d}/${m}`
}

export default function AdminOverviewPage() {
    const [data, setData] = useState<AdminOverview | null>(null)
    const [loading, setLoading] = useState(true)

    const [stats, setStats] = useState<AdminStats | null>(null)
    const [days, setDays] = useState<number>(30)
    const [loadingStats, setLoadingStats] = useState(true)

    useEffect(() => {
        AdminService.getOverview()
            .then(setData)
            .finally(() => setLoading(false))
    }, [])

    // Tải riêng khỏi /overview: đổi khoảng thời gian chỉ nạp lại biểu đồ, các card ở
    // trên không nháy lại.
    useEffect(() => {
        let cancelled = false
        setLoadingStats(true)
        AdminService.getStats(days)
            .then(s => { if (!cancelled) setStats(s) })
            .catch(() => { if (!cancelled) setStats(null) })
            .finally(() => { if (!cancelled) setLoadingStats(false) })
        return () => { cancelled = true }
    }, [days])

    const chartData = stats?.daily.map(d => ({ ...d, label: shortDate(d.date) })) ?? []

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
                <p className="mt-1 text-sm text-gray-500">Số liệu toàn hệ thống — chỉ xem, không chỉnh sửa nội dung.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatCard icon={Users} label="Tổng người dùng" value={loading ? '…' : data?.users.total ?? 0}
                    sub={loading ? undefined : `+${data?.users.new7Days} trong 7 ngày`} />
                {/* draftTests đã có trong response từ trước nhưng chưa hiện ra — Admin cần
                    biết bao nhiêu đề còn nháp (học viên chưa thấy được) chứ không chỉ tổng. */}
                <StatCard icon={FileText} label="Tổng đề thi" value={loading ? '…' : data?.content.totalTests ?? 0}
                    sub={loading ? undefined
                        : `${data?.content.publishedTests} đã xuất bản · ${data?.content.draftTests} nháp`} />
                <StatCard icon={HelpCircle} label="Tổng câu hỏi" value={loading ? '…' : data?.content.totalQuestions ?? 0} />
                <StatCard icon={BookMarked} label="Từ vựng" value={loading ? '…' : data?.content.totalVocabularies ?? 0} />
                <StatCard icon={CalendarDays} label="Lịch thi" value={loading ? '…' : data?.content.totalSchedules ?? 0}
                    sub={loading ? undefined : `${data?.content.upcomingSchedules} kỳ sắp tới`} />
                <StatCard icon={ClipboardCheck} label="Lượt thi đã hoàn thành" value={loading ? '…' : data?.exams.totalSessions ?? 0}
                    sub={loading ? undefined : `+${data?.exams.sessions7Days} trong 7 ngày`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <CardTitle className="text-sm font-medium text-gray-500">Điểm trung bình toàn hệ thống</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {loading ? '…' : data?.exams.averageScore ?? 0}
                            <span className="ml-1 text-sm font-normal text-gray-400">/ 990</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <Trophy className="h-4 w-4 text-gray-400" />
                        <CardTitle className="text-sm font-medium text-gray-500">Top 5 đề được làm nhiều nhất</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-gray-400">Đang tải…</p>
                        ) : !data?.topTests.length ? (
                            <p className="text-sm text-gray-400">Chưa có lượt thi nào.</p>
                        ) : (
                            <ol className="space-y-2">
                                {data.topTests.map((t, i) => (
                                    <li key={t.testId} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">
                                            <span className="mr-2 text-gray-400">{i + 1}.</span>{t.title}
                                        </span>
                                        <span className="font-medium text-gray-900">{t.attempts} lượt</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Hoạt động theo ngày ─────────────────────────────────── */}
            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <BarChart3 className="h-4 w-4 text-gray-400" />
                            Hoạt động theo ngày
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Người dùng mới và lượt thi hoàn thành mỗi ngày.
                        </CardDescription>
                    </div>
                    <div className="flex gap-1">
                        {RANGE_OPTIONS.map(d => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                    days === d
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {d} ngày
                            </button>
                        ))}
                    </div>
                </CardHeader>
                <CardContent>
                    {loadingStats ? (
                        <p className="py-12 text-center text-sm text-gray-400">Đang tải…</p>
                    ) : !stats ? (
                        <p className="py-12 text-center text-sm text-gray-400">
                            Không tải được số liệu biểu đồ.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                                    </linearGradient>
                                    <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                {/* interval tự giãn nhãn: 90 ngày mà hiện hết thì nhãn chồng nhau */}
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                                    interval="preserveStartEnd"
                                    minTickGap={24}
                                />
                                {/* allowDecimals=false: số người/lượt là số nguyên, trục
                                    hiện 0.5 là vô nghĩa (xảy ra khi giá trị max nhỏ) */}
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    labelFormatter={l => `Ngày ${l}`}
                                />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Area
                                    type="monotone" dataKey="newUsers" name="Người dùng mới"
                                    stroke="#2563eb" strokeWidth={2} fill="url(#gUsers)"
                                />
                                <Area
                                    type="monotone" dataKey="sessions" name="Lượt thi"
                                    stroke="#f97316" strokeWidth={2} fill="url(#gSessions)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </CardContent>
            </Card>

            {/* ── Phân bố điểm + tài khoản theo vai ───────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Phân bố điểm toàn hệ thống
                        </CardTitle>
                        <CardDescription>
                            Số lượt thi theo từng dải điểm — cho biết học viên đang tập trung ở mức nào.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <p className="py-10 text-center text-sm text-gray-400">Đang tải…</p>
                        ) : !stats?.scoreBands.some(b => b.count > 0) ? (
                            <p className="py-10 text-center text-sm text-gray-400">
                                Chưa có lượt thi nào được chấm điểm.
                            </p>
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={stats.scoreBands} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                                    <Tooltip
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                        formatter={(v: number) => [`${v} lượt`, 'Số lượt']}
                                        labelFormatter={l => `Dải điểm ${l}`}
                                    />
                                    <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-gray-500">
                            Tài khoản theo vai
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingStats ? (
                            <p className="text-sm text-gray-400">Đang tải…</p>
                        ) : !stats?.roles.length ? (
                            <p className="text-sm text-gray-400">Chưa có dữ liệu.</p>
                        ) : (
                            <ul className="space-y-3">
                                {stats.roles.map(r => (
                                    <li key={r.role} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">{ROLE_LABELS[r.role] ?? r.role}</span>
                                        <span className="font-semibold text-gray-900">{r.count}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

/** Tên vai hiển thị — DB lưu tên kỹ thuật, UI cần tiếng Việt */
const ROLE_LABELS: Record<string, string> = {
    User: 'Học viên',
    ContentManager: 'Quản lý nội dung',
    Admin: 'Quản trị viên',
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
            </CardContent>
        </Card>
    )
}
