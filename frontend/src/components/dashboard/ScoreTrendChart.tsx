/**
 * Biểu đồ đường xu hướng điểm — Day 32.
 *
 * Trục X = các lần thi theo thứ tự thời gian (backend đã sort cũ → mới).
 * Trục Y = thang điểm TOEIC 0–990, DÙNG CHUNG cho cả 3 đường vì cùng đơn vị.
 *   (Không bao giờ dùng 2 trục Y — đó là lỗi biểu đồ phổ biến nhất:
 *    2 thang khác nhau khiến người đọc so sánh sai độ dốc.)
 */
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { CHART_INK, CHART_SERIES, CHART_STATUS } from '@/lib/chartColors'
import type { DashboardScorePoint } from '@/types/test-session.types'

interface ScoreTrendChartProps {
    points: DashboardScorePoint[]
    targetScore: number
    onPointClick?: (sessionId: string) => void
}

/** Dữ liệu 1 chấm sau khi thêm nhãn hiển thị */
interface TrendRow extends DashboardScorePoint {
    label: string
    fullDate: string
}

function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
    })
}

function fullDate(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

interface TrendTooltipProps {
    active?: boolean
    payload?: Array<{ payload: TrendRow }>
    targetScore: number
}

function TrendTooltip({ active, payload, targetScore }: TrendTooltipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload
    const diff = row.totalScore != null ? row.totalScore - targetScore : null

    return (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
            <p className="font-semibold text-[#1a4d7c]">{row.testTitle || 'Đề thi'}</p>
            <p className="text-xs text-muted-foreground">{row.fullDate}</p>
            <p className="mt-1.5 tabular-nums">
                Tổng: <span className="font-bold">{row.totalScore ?? '—'}</span>
                {diff != null && (
                    <span
                        className={
                            diff >= 0 ? 'ml-1 text-emerald-600' : 'ml-1 text-amber-600'
                        }
                    >
                        ({diff >= 0 ? '+' : ''}
                        {diff} so với mục tiêu)
                    </span>
                )}
            </p>
            <p className="tabular-nums text-muted-foreground">
                Listening {row.listeningScore ?? '—'} · Reading {row.readingScore ?? '—'}
            </p>
            {!row.isFullTest && (
                <p className="mt-1 text-xs text-amber-600">Thi lẻ Part (không phải full test)</p>
            )}
        </div>
    )
}

export default function ScoreTrendChart({
    points,
    targetScore,
    onPointClick,
}: ScoreTrendChartProps) {
    const rows: TrendRow[] = points.map((p) => ({
        ...p,
        label: shortDate(p.completedAt),
        fullDate: fullDate(p.completedAt),
    }))

    return (
        <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                    {/* Lưới ngang mờ — chỉ hỗ trợ đọc giá trị, không được nổi hơn dữ liệu */}
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_INK.grid} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: CHART_INK.axis }}
                        tickLine={false}
                        axisLine={{ stroke: CHART_INK.grid }}
                    />
                    <YAxis
                        domain={[0, 990]}
                        ticks={[0, 200, 400, 600, 800, 990]}
                        tick={{ fontSize: 11, fill: CHART_INK.axis }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                    />
                    <Tooltip
                        content={<TrendTooltip targetScore={targetScore} />}
                        cursor={{ stroke: CHART_INK.axis, strokeDasharray: '3 3' }}
                    />
                    <Legend
                        verticalAlign="bottom"
                        height={28}
                        iconType="plainline"
                        wrapperStyle={{ fontSize: 12 }}
                    />
                    <ReferenceLine
                        y={targetScore}
                        stroke={CHART_STATUS.target}
                        strokeDasharray="6 4"
                        label={{
                            value: `Mục tiêu ${targetScore}`,
                            position: 'insideTopRight',
                            fill: CHART_STATUS.target,
                            fontSize: 11,
                        }}
                    />
                    {/* Tổng điểm vẽ đậm nhất — đây là con số user quan tâm nhất */}
                    <Line
                        type="monotone"
                        dataKey="totalScore"
                        name="Tổng điểm"
                        stroke={CHART_SERIES.total}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                        activeDot={{
                            r: 6,
                            cursor: onPointClick ? 'pointer' : 'default',
                            onClick: (_e: unknown, payload: unknown) => {
                                const row = (payload as { payload?: TrendRow })?.payload
                                if (row && onPointClick) onPointClick(row.sessionId)
                            },
                        }}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey="listeningScore"
                        name="Listening"
                        stroke={CHART_SERIES.listening}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                    />
                    <Line
                        type="monotone"
                        dataKey="readingScore"
                        name="Reading"
                        stroke={CHART_SERIES.reading}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}
