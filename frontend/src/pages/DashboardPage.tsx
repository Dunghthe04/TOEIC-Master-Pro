/**
 * Dashboard User — Day 32 Bước 5–6.
 * Cards (overview) + biểu đồ Recharts (timeline) + phân tích Part + quick links.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    BarChart3,
    BookMarked,
    BookOpen,
    ClipboardList,
    History,
    LayoutDashboard,
    Target,
    TrendingUp,
    Trophy,
} from 'lucide-react'
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { toast } from 'sonner'
import ExamPartBreakdownPanel from '@/components/exam/ExamPartBreakdownPanel'
import { TestSessionService } from '@/services/test-session.service'
import type {
    TestStatsOverviewResponse,
    TestStatsPartsResponse,
    TestStatsTimelineItem,
    TestStatsTimelineResponse,
} from '@/types/test-session.types'
import { useAuthStore } from '@/store/auth.store'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Định dạng ngày nộp bài gần nhất */
function formatCompletedAt(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    })
}

/** Nhãn ngắn trên trục X biểu đồ timeline */
function formatChartDate(iso: string): string {
    return new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    })
}

/** Hiển thị điểm hoặc gạch ngang */
function formatScore(score: number | null | undefined): string {
    return score != null ? String(score) : '—'
}

/**
 * Màu cho ô chưa có số liệu. Làm nhạt để dấu "—" đọc ra là "chờ dữ liệu"
 * chứ không bị nhìn thành một con số thật hoặc thành lỗi tải.
 */
const PLACEHOLDER_VALUE_CLASS = 'text-muted-foreground/60'

type StatCardProps = {
    title: string
    value: string
    description?: string
    icon: ReactNode
    valueClassName?: string
    onClick?: () => void
}

/** Card số liệu tái dùng — có thể bấm để điều hướng */
function StatCard({
    title,
    value,
    description,
    icon,
    valueClassName,
    onClick,
}: StatCardProps) {
    const clickable = Boolean(onClick)

    return (
        <Card
            className={cn(
                'shadow-sm transition-colors',
                clickable && 'cursor-pointer hover:border-[#1a4d7c]/40 hover:bg-[#1a4d7c]/[0.02]'
            )}
            onClick={onClick}
            onKeyDown={
                clickable
                    ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onClick?.()
                          }
                      }
                    : undefined
            }
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
        >
            <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {icon}
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        {title}
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <p
                    className={cn(
                        'text-2xl font-bold tabular-nums text-[#1a4d7c]',
                        valueClassName
                    )}
                >
                    {value}
                </p>
                {description ? (
                    <CardDescription className="mt-1">{description}</CardDescription>
                ) : null}
            </CardContent>
        </Card>
    )
}

/** Dòng dữ liệu line chart — Recharts */
interface TimelineChartRow extends TestStatsTimelineItem {
    chartLabel: string
    score: number
}

interface TimelineTooltipProps {
    active?: boolean
    payload?: Array<{ payload: TimelineChartRow }>
    targetScore: number
}

/** Tooltip line chart — điểm + L/R + tên đề */
function TimelineTooltip({ active, payload, targetScore }: TimelineTooltipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload

    return (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
            <p className="font-semibold text-[#1a4d7c]">{row.testTitle}</p>
            <p className="text-xs text-muted-foreground">{row.testSeries}</p>
            <p className="mt-1 tabular-nums">
                Total:{' '}
                <span className="font-bold">{row.totalScore ?? '—'}</span>
                <span className="text-muted-foreground"> / mục tiêu {targetScore}</span>
            </p>
            <p className="tabular-nums text-muted-foreground">
                L {row.listeningScore ?? '—'} · R {row.readingScore ?? '—'}
            </p>
            <p className="text-xs text-muted-foreground">
                {formatCompletedAt(row.completedAt)}
            </p>
        </div>
    )
}

const EMPTY_OVERVIEW: TestStatsOverviewResponse = {
    targetScore: 700,
    totalAttempts: 0,
    distinctTests: 0,
    bestTotalScore: null,
    bestSessionId: null,
    latestTotalScore: null,
    latestSessionId: null,
    averageTotalScore: null,
    lastCompletedAt: null,
}

const EMPTY_TIMELINE: TestStatsTimelineResponse = {
    targetScore: 700,
    items: [],
}

const EMPTY_PARTS: TestStatsPartsResponse = {
    sessionsAnalyzed: 0,
    parts: [],
    weakestParts: [],
}

/** Liên kết nhanh tới các module chính */
const QUICK_LINKS = [
    { to: '/mock-test', label: 'Thi thử', icon: ClipboardList },
    { to: '/mock-test/history', label: 'Lịch sử thi', icon: History },
    { to: '/mock-test/progress', label: 'Tiến độ thi', icon: BarChart3 },
    { to: '/practice', label: 'Luyện nhanh', icon: BookOpen },
    { to: '/vocabulary', label: 'Từ vựng', icon: BookMarked },
] as const

export default function DashboardPage() {
    const navigate = useNavigate()
    const user = useAuthStore((state) => state.user)
    const [overview, setOverview] = useState<TestStatsOverviewResponse>(EMPTY_OVERVIEW)
    const [timeline, setTimeline] = useState<TestStatsTimelineResponse>(EMPTY_TIMELINE)
    const [partsStats, setPartsStats] = useState<TestStatsPartsResponse>(EMPTY_PARTS)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    /** false = gồm thi theo part — giống Tiến độ thi */
    const [fullOnly, setFullOnly] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setLoadError(false)
        try {
            const [overviewData, timelineData, partsData] = await Promise.all([
                TestSessionService.getStatsOverview({ fullOnly }),
                TestSessionService.getStatsTimeline({ fullOnly }),
                TestSessionService.getStatsParts({ fullOnly }),
            ])
            setOverview(overviewData)
            setTimeline(timelineData)
            setPartsStats(partsData)
        } catch {
            setLoadError(true)
            toast.error('Không tải được dashboard. Vui lòng thử lại.')
        } finally {
            setLoading(false)
        }
    }, [fullOnly])

    useEffect(() => {
        load()
    }, [load])

    const gapToTarget = useMemo(() => {
        if (overview.bestTotalScore == null) return null
        return overview.targetScore - overview.bestTotalScore
    }, [overview.bestTotalScore, overview.targetScore])

    const hasAttempts = overview.totalAttempts > 0

    const timelineChartData = useMemo<TimelineChartRow[]>(
        () =>
            timeline.items
                .filter((item) => item.totalScore != null)
                .map((item) => ({
                    ...item,
                    chartLabel: formatChartDate(item.completedAt),
                    score: item.totalScore!,
                })),
        [timeline.items]
    )

    const targetScore = overview.targetScore

    const goToSession = (sessionId: string | null) => {
        if (sessionId) navigate(`/mock-test/history/${sessionId}`)
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#eef2f6] to-white px-4 py-8 md:py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-[#1a4d7c]">
                        <LayoutDashboard className="h-7 w-7" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                            Dashboard
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Chào mừng{' '}
                        <span className="font-medium text-foreground">
                            {user?.fullName ?? 'bạn'}
                        </span>
                        ! Tổng quan tiến độ luyện thi TOEIC.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={fullOnly ? 'outline' : 'default'}
                            className={fullOnly ? '' : 'bg-[#1a4d7c] hover:bg-[#1a4d7c]/90'}
                            onClick={() => setFullOnly(false)}
                        >
                            Tất cả lần thi
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={fullOnly ? 'default' : 'outline'}
                            className={fullOnly ? 'bg-[#1a4d7c] hover:bg-[#1a4d7c]/90' : ''}
                            onClick={() => setFullOnly(true)}
                        >
                            Chỉ full test
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        Đang tải dashboard…
                    </p>
                ) : loadError ? (
                    <Card className="border border-border shadow-sm">
                        <CardContent className="space-y-4 py-12 text-center">
                            <p className="font-medium text-foreground">
                                Không tải được dữ liệu
                            </p>
                            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                                Vui lòng thử lại sau.
                            </p>
                            <Button
                                className="bg-[#1a4d7c] hover:bg-[#1a4d7c]/90"
                                onClick={() => load()}
                            >
                                Thử lại
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Chưa có lần thi: KHÔNG thay cả trang bằng một card trống — giữ nguyên
                            bố cục dashboard để người dùng thấy trước mình sẽ nhận được gì, chỉ
                            thêm một banner mảnh làm lời gọi hành động. */}
                        {!hasAttempts && (
                            <Card className="border-[#1a4d7c]/25 bg-[#1a4d7c]/[0.03] shadow-sm">
                                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                                    <ClipboardList className="h-5 w-5 shrink-0 text-[#1a4d7c]" />
                                    {fullOnly ? (
                                        <>
                                            {/* Đừng chỉ nói "chưa có" — người đã thi theo part mà thấy
                                                trống trơn sẽ tưởng mất dữ liệu, nên chỉ luôn đường ra. */}
                                            <p className="min-w-0 flex-1 text-sm">
                                                <span className="font-medium text-foreground">
                                                    Chưa có lần full test nào đã nộp.
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                    Nếu bạn mới thi theo part (Part 1, 5, 6…), chọn
                                                    「Tất cả lần thi」để xem thống kê.
                                                </span>
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setFullOnly(false)}
                                            >
                                                Xem tất cả lần thi
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <p className="min-w-0 flex-1 text-sm">
                                                <span className="font-medium text-foreground">
                                                    Bạn chưa có lần thi nào.
                                                </span>{' '}
                                                <span className="text-muted-foreground">
                                                    Làm đề thử đầu tiên để dashboard hiển thị điểm,
                                                    tiến độ và Part cần cải thiện.
                                                </span>
                                            </p>
                                            <Button
                                                size="sm"
                                                className="bg-[#1a4d7c] hover:bg-[#1a4d7c]/90"
                                                onClick={() => navigate('/mock-test')}
                                            >
                                                Thi thử ngay
                                            </Button>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <StatCard
                                title="Mục tiêu TOEIC"
                                value={formatScore(overview.targetScore)}
                                description="Cập nhật trong hồ sơ cá nhân"
                                icon={<Target className="h-4 w-4" />}
                            />
                            {/* Số 0 là dữ liệu thật, không phải "thiếu dữ liệu" — vẫn hiện đậm.
                                Chỉ bỏ onClick vì lịch sử trống, bấm vào là dẫn vào chỗ cụt. */}
                            <StatCard
                                title="Lần thi"
                                value={String(overview.totalAttempts)}
                                description={`${overview.distinctTests} đề khác nhau`}
                                icon={<History className="h-4 w-4" />}
                                onClick={
                                    hasAttempts
                                        ? () => navigate('/mock-test/history')
                                        : undefined
                                }
                            />
                            <StatCard
                                title="Điểm cao nhất"
                                value={formatScore(overview.bestTotalScore)}
                                description={
                                    gapToTarget != null && gapToTarget > 0
                                        ? `Còn ${gapToTarget} điểm tới mục tiêu`
                                        : gapToTarget != null && gapToTarget <= 0
                                          ? 'Đã đạt mục tiêu!'
                                          : 'Sau lần thi đầu tiên'
                                }
                                icon={<Trophy className="h-4 w-4" />}
                                valueClassName={
                                    overview.bestTotalScore == null
                                        ? PLACEHOLDER_VALUE_CLASS
                                        : overview.bestTotalScore >= overview.targetScore
                                          ? 'text-emerald-600'
                                          : undefined
                                }
                                onClick={
                                    overview.bestSessionId
                                        ? () => goToSession(overview.bestSessionId)
                                        : undefined
                                }
                            />
                            <StatCard
                                title="Lần gần nhất"
                                value={formatScore(overview.latestTotalScore)}
                                description={
                                    overview.lastCompletedAt != null
                                        ? `Nộp ${formatCompletedAt(overview.lastCompletedAt)}`
                                        : 'Sau lần thi đầu tiên'
                                }
                                icon={<TrendingUp className="h-4 w-4" />}
                                valueClassName={
                                    overview.latestTotalScore == null
                                        ? PLACEHOLDER_VALUE_CLASS
                                        : undefined
                                }
                                onClick={
                                    overview.latestSessionId
                                        ? () => goToSession(overview.latestSessionId)
                                        : undefined
                                }
                            />
                            <StatCard
                                title="Điểm trung bình"
                                value={
                                    overview.averageTotalScore != null
                                        ? overview.averageTotalScore.toFixed(1)
                                        : '—'
                                }
                                description={
                                    overview.averageTotalScore != null
                                        ? 'Trung bình các lần có điểm Total'
                                        : 'Sau lần thi đầu tiên'
                                }
                                icon={<BarChart3 className="h-4 w-4" />}
                                valueClassName={
                                    overview.averageTotalScore == null
                                        ? PLACEHOLDER_VALUE_CLASS
                                        : undefined
                                }
                            />
                            {/* Ẩn khi chưa thi: trang tiến độ lúc đó trống, mở ra chỉ gây thất vọng */}
                            {hasAttempts && (
                                <StatCard
                                    title="Tiến độ theo đề"
                                    value="Xem"
                                    description="Best score từng đề thi"
                                    icon={<BarChart3 className="h-4 w-4" />}
                                    onClick={() => navigate('/mock-test/progress')}
                                />
                            )}
                        </div>

                        {/* Line chart — Recharts (Day 32 Bước 6) */}
                        <Card className="overflow-hidden border-2 border-[#1a4d7c]/20 shadow-lg">
                            <CardHeader className="border-b border-[#1a4d7c]/10 bg-[#1a4d7c] text-white">
                                <CardTitle className="text-base font-semibold tracking-wide">
                                    Điểm theo thời gian
                                </CardTitle>
                                <CardDescription className="text-white/80">
                                    Mỗi điểm = một lần thi — bấm điểm để xem chi tiết
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6">
                                {timelineChartData.length === 0 ? (
                                    <p className="py-8 text-center text-sm text-muted-foreground">
                                        Chưa có lần thi nào có điểm Total để vẽ biểu đồ.
                                    </p>
                                ) : (
                                    <>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart
                                                    data={timelineChartData}
                                                    margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                                                >
                                                    <CartesianGrid
                                                        strokeDasharray="3 3"
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey="chartLabel"
                                                        tick={{ fontSize: 11 }}
                                                        interval="preserveStartEnd"
                                                    />
                                                    <YAxis
                                                        domain={[0, 990]}
                                                        tick={{ fontSize: 12 }}
                                                        width={36}
                                                    />
                                                    <Tooltip
                                                        content={
                                                            <TimelineTooltip
                                                                targetScore={targetScore}
                                                            />
                                                        }
                                                    />
                                                    <ReferenceLine
                                                        y={targetScore}
                                                        stroke="#ef4444"
                                                        strokeDasharray="6 4"
                                                        label={{
                                                            value: `Mục tiêu ${targetScore}`,
                                                            position: 'insideTopRight',
                                                            fill: '#ef4444',
                                                            fontSize: 12,
                                                        }}
                                                    />
                                                    <Line
                                                        type="monotone"
                                                        dataKey="score"
                                                        stroke="#1a4d7c"
                                                        strokeWidth={2}
                                                        dot={(props) => {
                                                            const { cx, cy, payload } = props
                                                            if (cx == null || cy == null) return null
                                                            const row = payload as TimelineChartRow
                                                            return (
                                                                <circle
                                                                    cx={cx}
                                                                    cy={cy}
                                                                    r={5}
                                                                    fill="#1a4d7c"
                                                                    cursor="pointer"
                                                                    onClick={() =>
                                                                        goToSession(row.sessionId)
                                                                    }
                                                                />
                                                            )
                                                        }}
                                                        activeDot={{ r: 7, cursor: 'pointer' }}
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <p className="mt-3 text-center text-xs text-muted-foreground">
                                            Gom từ {timeline.items.length} lần thi
                                            {partsStats.sessionsAnalyzed > 0 &&
                                                ` · Phân tích Part từ ${partsStats.sessionsAnalyzed} phiên`}
                                        </p>
                                    </>
                                )}
                            </CardContent>
                        </Card>

                        {/* Part yếu — tái dùng panel Day 30 (thanh % CSS, không Recharts) */}
                        {partsStats.parts.length > 0 && (
                            <div className="-mt-2">
                                <ExamPartBreakdownPanel items={partsStats.parts} />
                                <p className="mt-2 text-center text-xs text-muted-foreground">
                                    Gom {partsStats.sessionsAnalyzed} lần thi — Part yếu nhất:{' '}
                                    <strong>
                                        {partsStats.weakestParts
                                            .map((p) => `Part ${p}`)
                                            .join(', ') || '—'}
                                    </strong>
                                </p>
                            </div>
                        )}

                        {/* Quick links */}
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base text-[#1a4d7c]">
                                    Truy cập nhanh
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2">
                                    {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
                                        <Button
                                            key={to}
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => navigate(to)}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {label}
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    )
}
