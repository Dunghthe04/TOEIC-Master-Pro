/**
 * Dashboard người học — Day 32.
 *
 * Trang trả lời 3 câu hỏi, theo đúng thứ tự user quan tâm:
 *   1. Mình đang ở đâu?      → 4 thẻ số liệu
 *   2. Mình có tiến bộ không? → biểu đồ đường xu hướng điểm
 *   3. Mình yếu chỗ nào?      → biểu đồ Part + gợi ý luyện
 *
 * Chỉ gọi 1 API (/test-session/dashboard) — backend đã gộp sẵn.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    CalendarDays,
    ClipboardList,
    History,
    Target,
    TrendingUp,
    Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import PartAccuracyChart from '@/components/dashboard/PartAccuracyChart'
import ScoreTrendChart from '@/components/dashboard/ScoreTrendChart'
import StatTile from '@/components/dashboard/StatTile'
import { formatPartLabel, partSkillLabel } from '@/lib/partBreakdown'
import { TestSessionService } from '@/services/test-session.service'
import { useAuthStore } from '@/store/auth.store'
import type { DashboardSummaryResponse } from '@/types/test-session.types'

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export default function DashboardPage() {
    const navigate = useNavigate()
    const user = useAuthStore((state) => state.user)
    const [data, setData] = useState<DashboardSummaryResponse | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            setData(await TestSessionService.getDashboard(10))
        } catch {
            toast.error('Không tải được dữ liệu dashboard.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    const greeting = (
        <div>
            <h1 className="text-2xl font-bold text-gray-800">
                Chào {user?.fullName ?? 'bạn'} 👋
            </h1>
            <p className="mt-1 text-gray-500">
                {data && data.totalSessions > 0
                    ? `Bạn đã hoàn thành ${data.totalSessions} lần thi. Mục tiêu hiện tại: ${data.targetScore} điểm.`
                    : 'Cùng xem hôm nay luyện gì nhé.'}
            </p>
        </div>
    )

    if (loading) {
        return (
            <div className="space-y-6">
                {greeting}
                <p className="text-sm text-muted-foreground">Đang tải dữ liệu…</p>
            </div>
        )
    }

    // ── Chưa thi lần nào → dẫn thẳng vào luồng chính thay vì hiện chart rỗng ──
    if (!data || data.totalSessions === 0) {
        return (
            <div className="space-y-6">
                {greeting}
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                        <ClipboardList className="size-10 text-[#1a4d7c]/40" aria-hidden />
                        <div>
                            <p className="font-medium text-gray-800">
                                Bạn chưa hoàn thành lần thi nào
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Làm thử một đề để hệ thống phân tích điểm mạnh / điểm yếu của bạn.
                            </p>
                        </div>
                        <Button
                            className="mt-2 bg-[#1a4d7c] hover:bg-[#1a4d7c]/90"
                            onClick={() => navigate('/mock-test')}
                        >
                            Bắt đầu thi thử
                            <ArrowRight className="ml-1 size-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const reachedTarget = data.pointsToTarget === 0
    const weakItems = data.partAccuracy.filter((p) => data.weakParts.includes(p.part))

    return (
        <div className="space-y-6 pb-8">
            {greeting}

            {/* ── 1. Mình đang ở đâu ── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                    icon={Trophy}
                    label="Điểm cao nhất"
                    value={data.bestTotalScore ?? '—'}
                    tone={reachedTarget ? 'good' : 'default'}
                    hint={
                        data.pointsToTarget == null
                            ? undefined
                            : reachedTarget
                              ? '🎉 Đã đạt mục tiêu'
                              : `Còn ${data.pointsToTarget} điểm nữa đạt mục tiêu`
                    }
                />
                <StatTile
                    icon={TrendingUp}
                    label="Điểm gần nhất"
                    value={data.latestTotalScore ?? '—'}
                    hint={
                        data.averageTotalScore != null
                            ? `Trung bình ${data.averageTotalScore}`
                            : undefined
                    }
                />
                <StatTile
                    icon={Target}
                    label="Độ chính xác"
                    value={`${data.overallAccuracyPercent.toFixed(1)}%`}
                    tone={
                        data.overallAccuracyPercent >= 80
                            ? 'good'
                            : data.overallAccuracyPercent < 60
                              ? 'warning'
                              : 'default'
                    }
                    hint={`${data.answeredQuestions} câu đã làm`}
                />
                <StatTile
                    icon={CalendarDays}
                    label="Số lần thi"
                    value={data.totalSessions}
                    hint={
                        data.lastCompletedAt
                            ? `Gần nhất ${formatDateTime(data.lastCompletedAt)}`
                            : undefined
                    }
                />
            </div>

            {/* ── 2. Mình có tiến bộ không ── */}
            <Card className="border-[#1a4d7c]/20 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-[#1a4d7c]">
                                <TrendingUp className="size-5 shrink-0" aria-hidden />
                                Xu hướng điểm
                            </CardTitle>
                            <CardDescription className="mt-1">
                                {data.scoreTrend.length} lần thi gần nhất · bấm vào chấm để xem
                                lại chi tiết
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/mock-test/progress')}
                        >
                            Tiến độ theo đề
                            <ArrowRight className="ml-1 size-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-5">
                    {data.scoreTrend.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Chưa có lần thi nào được chấm điểm.
                        </p>
                    ) : (
                        <ScoreTrendChart
                            points={data.scoreTrend}
                            targetScore={data.targetScore}
                            onPointClick={(sessionId) =>
                                navigate(`/mock-test/history/${sessionId}`)
                            }
                        />
                    )}
                </CardContent>
            </Card>

            {/* ── 3. Mình yếu chỗ nào ── */}
            <Card className="border-[#1a4d7c]/20 shadow-sm">
                <CardHeader className="border-b border-border/60 pb-4">
                    <CardTitle className="flex items-center gap-2 text-[#1a4d7c]">
                        <BarChart3 className="size-5 shrink-0" aria-hidden />
                        Độ chính xác theo Part
                    </CardTitle>
                    <CardDescription className="mt-1">
                        Gộp tối đa 20 lần thi gần nhất — phản ánh trình độ hiện tại, không phải
                        trung bình từ đầu.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pt-5">
                    {data.partAccuracy.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            Chưa đủ dữ liệu để phân tích Part.
                        </p>
                    ) : (
                        <>
                            <PartAccuracyChart
                                items={data.partAccuracy}
                                weakParts={data.weakParts}
                            />

                            {weakItems.length > 0 && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <p className="flex items-center gap-2 text-sm font-medium text-amber-950">
                                        <AlertTriangle
                                            className="size-4 shrink-0 text-amber-600"
                                            aria-hidden
                                        />
                                        Nên ưu tiên ôn những Part này
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {weakItems.map((item) => (
                                            <Button
                                                key={item.part}
                                                variant="outline"
                                                size="sm"
                                                className="border-amber-300 bg-white hover:bg-amber-100"
                                                // Luyện nhanh chỉ có Part 1–4 (Listening);
                                                // Part 5–7 phải vào thi thử rồi chọn lẻ Part đó
                                                onClick={() =>
                                                    navigate(
                                                        item.part <= 4
                                                            ? `/practice?part=${item.part}`
                                                            : '/mock-test'
                                                    )
                                                }
                                            >
                                                <span className="font-semibold">
                                                    {formatPartLabel(item.part)}
                                                </span>
                                                <span className="ml-1.5 text-xs text-muted-foreground">
                                                    {partSkillLabel(item.part)} ·{' '}
                                                    {item.accuracyPercent.toFixed(0)}%
                                                </span>
                                                <ArrowRight className="ml-1 size-3.5" />
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ── Lối tắt sang các luồng chính ── */}
            <div className="grid gap-3 sm:grid-cols-3">
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => navigate('/mock-test')}
                >
                    <ClipboardList className="mr-2 size-4" />
                    Thi thử đề mới
                </Button>
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => navigate('/mock-test/history')}
                >
                    <History className="mr-2 size-4" />
                    Lịch sử thi
                </Button>
                <Button
                    variant="outline"
                    className="justify-start"
                    onClick={() => navigate('/exam-schedule')}
                >
                    <CalendarDays className="mr-2 size-4" />
                    Lịch thi TOEIC
                </Button>
            </div>
        </div>
    )
}
