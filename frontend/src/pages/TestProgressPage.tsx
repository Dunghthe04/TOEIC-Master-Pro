/**
 * Tiến độ thi — Day 31 Bước 6.
 * Biểu đồ best score / đề so với mục tiêu; bấm cột → lịch sử đề đó.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { TestSessionService } from '@/services/test-session.service'
import type { TestScoreByTestItem } from '@/types/test-session.types'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BarChart3, Target, Trophy } from 'lucide-react'
import { toast } from 'sonner'

/** Dữ liệu 1 cột trên biểu đồ */
interface ChartRow extends TestScoreByTestItem {
    score: number
    meetsTarget: boolean
    shortTitle: string
}

function truncateTitle(title: string, max = 18): string {
    if (title.length <= max) return title
    return `${title.slice(0, max - 1)}…`
}

interface ChartTooltipProps {
    active?: boolean
    payload?: Array<{ payload: ChartRow }>
    targetScore: number
}

/** Tooltip tùy chỉnh — hiển thị L/R và số lần thi */
function ChartTooltip({ active, payload, targetScore }: ChartTooltipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload

    return (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
            <p className="font-semibold text-[#1a4d7c]">{row.testTitle}</p>
            <p className="text-xs text-muted-foreground">{row.testSeries}</p>
            <p className="mt-1 tabular-nums">
                Best: <span className="font-bold">{row.bestTotalScore ?? '—'}</span>
                <span className="text-muted-foreground"> / mục tiêu {targetScore}</span>
            </p>
            <p className="tabular-nums text-muted-foreground">
                L {row.bestListeningScore ?? '—'} · R {row.bestReadingScore ?? '—'}
            </p>
            <p className="text-muted-foreground">{row.attemptCount} lần thi</p>
        </div>
    )
}

export default function TestProgressPage() {
    const navigate = useNavigate()
    const [targetScore, setTargetScore] = useState(700)
    const [items, setItems] = useState<TestScoreByTestItem[]>([])
    const [loading, setLoading] = useState(true)
    /** false = gồm cả thi theo part — mặc định vì user thường chưa full test ngay */
    const [fullOnly, setFullOnly] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await TestSessionService.getScoreStatsByTest(fullOnly)
            setTargetScore(data.targetScore)
            setItems(data.items)
        } catch {
            toast.error('Không tải được tiến độ thi.')
        } finally {
            setLoading(false)
        }
    }, [fullOnly])

    useEffect(() => {
        load()
    }, [load])

    const chartData = useMemo<ChartRow[]>(
        () =>
            items.map((item) => {
                const score = item.bestTotalScore ?? 0
                return {
                    ...item,
                    score,
                    meetsTarget: item.bestTotalScore != null && item.bestTotalScore >= targetScore,
                    shortTitle: truncateTitle(item.testTitle),
                }
            }),
        [items, targetScore]
    )

    const passedCount = chartData.filter((row) => row.meetsTarget).length
    const bestOverall = chartData.reduce<number | null>((max, row) => {
        if (row.bestTotalScore == null) return max
        return max == null || row.bestTotalScore > max ? row.bestTotalScore : max
    }, null)

    const handleBarClick = (row: ChartRow) => {
        navigate(`/mock-test/history?testId=${row.testId}`)
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#eef2f6] to-white px-4 py-8 md:py-10">
            <div className="mx-auto w-full max-w-5xl space-y-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground -ml-2"
                    onClick={() => navigate('/mock-test')}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Danh sách đề
                </Button>

                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center gap-2 text-[#1a4d7c]">
                        <BarChart3 className="w-7 h-7" />
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Tiến độ thi
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {fullOnly
                            ? `Best score full test / đề — so với mục tiêu ${targetScore}`
                            : `Best score mọi lần thi / đề (gồm thi theo part) — so với mục tiêu ${targetScore}`}
                    </p>
                    <div className="flex justify-center gap-2 pt-1">
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

                {!loading && chartData.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Target className="w-4 h-4" />
                                Mục tiêu
                            </div>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-[#1a4d7c]">
                                {targetScore}
                            </p>
                        </div>
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Trophy className="w-4 h-4" />
                                Đạt mục tiêu
                            </div>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600">
                                {passedCount}/{chartData.length}
                            </p>
                        </div>
                        <div className="rounded-xl border bg-white p-4 shadow-sm">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <BarChart3 className="w-4 h-4" />
                                Best tổng
                            </div>
                            <p className="mt-1 text-2xl font-bold tabular-nums text-[#1a4d7c]">
                                {bestOverall ?? '—'}
                            </p>
                        </div>
                    </div>
                )}

                <div className="rounded-xl border-2 border-[#1a4d7c]/20 bg-white shadow-lg overflow-hidden">
                    <div className="bg-[#1a4d7c] text-white px-6 md:px-8 py-4 text-center">
                        <p className="font-semibold tracking-wide uppercase text-sm md:text-base">
                            {fullOnly
                                ? 'Best score theo đề (full test)'
                                : 'Best score theo đề (mọi lần thi)'}
                        </p>
                    </div>

                    {loading ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            Đang tải…
                        </p>
                    ) : chartData.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                            {fullOnly ? (
                                <>
                                    <p>Chưa có lần full test nào đã nộp.</p>
                                    <p className="text-xs">
                                        Nếu bạn mới thi theo part (Part 1, 5, 6…), hãy chọn
                                        「Tất cả lần thi」ở trên để xem biểu đồ.
                                    </p>
                                    <Button
                                        variant="link"
                                        className="block mx-auto"
                                        onClick={() => setFullOnly(false)}
                                    >
                                        Xem tất cả lần thi
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p>Chưa có lần thi nào đã nộp.</p>
                                    <Button
                                        variant="link"
                                        className="block mx-auto mt-2"
                                        onClick={() => navigate('/mock-test')}
                                    >
                                        Làm đề thử ngay
                                    </Button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 md:p-6">
                            <div className="h-[360px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartData}
                                        margin={{ top: 12, right: 12, left: 0, bottom: 48 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="shortTitle"
                                            tick={{ fontSize: 11 }}
                                            interval={0}
                                            angle={-28}
                                            textAnchor="end"
                                            height={64}
                                        />
                                        <YAxis
                                            domain={[0, 990]}
                                            tick={{ fontSize: 12 }}
                                            width={36}
                                        />
                                        <Tooltip
                                            content={
                                                <ChartTooltip targetScore={targetScore} />
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
                                        <Bar
                                            dataKey="score"
                                            radius={[6, 6, 0, 0]}
                                            cursor="pointer"
                                            onClick={(_data, index) => {
                                                const row = chartData[index]
                                                if (row) handleBarClick(row)
                                            }}
                                        >
                                            {chartData.map((row) => (
                                                <Cell
                                                    key={row.testId}
                                                    fill={
                                                        row.meetsTarget ? '#16a34a' : '#f59e0b'
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600" />
                                    Đạt mục tiêu
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
                                    Chưa đạt
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="inline-block h-8 w-0 border-l-2 border-dashed border-red-500" />
                                    Đường mục tiêu
                                </span>
                            </div>
                            <p className="mt-3 text-center text-xs text-muted-foreground">
                                Bấm cột để xem lịch sử chi tiết từng lần thi của đề đó.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
