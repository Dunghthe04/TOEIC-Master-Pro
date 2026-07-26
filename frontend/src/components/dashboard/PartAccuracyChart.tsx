/**
 * Độ chính xác theo Part (gộp nhiều lần thi) — Day 32.
 *
 * Khác ExamPartBreakdownPanel (Day 30): panel đó là kết quả CỦA MỘT lần thi,
 * chart này gộp tối đa 20 lần gần nhất để chỉ ra điểm yếu dài hạn.
 *
 * Part yếu được đánh dấu bằng MÀU + NHÃN CHỮ, không dựa vào màu một mình
 * (người mù màu vẫn đọc được).
 */
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { CHART_INK, CHART_SERIES, CHART_STATUS } from '@/lib/chartColors'
import { formatPartLabel, partSkillLabel } from '@/lib/partBreakdown'
import type { PartBreakdownItem } from '@/types/test-session.types'

interface PartAccuracyChartProps {
    items: PartBreakdownItem[]
    weakParts: number[]
}

interface PartRow extends PartBreakdownItem {
    label: string
    skill: string
    isWeak: boolean
}

interface PartTooltipProps {
    active?: boolean
    payload?: Array<{ payload: PartRow }>
}

function PartTooltip({ active, payload }: PartTooltipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0].payload

    return (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
            <p className="font-semibold text-[#1a4d7c]">
                {row.label}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    {row.skill}
                </span>
            </p>
            <p className="mt-1 tabular-nums">
                Đúng <span className="font-bold">{row.correct}</span> / {row.total} câu
            </p>
            <p className="tabular-nums text-muted-foreground">
                Tỷ lệ {row.accuracyPercent.toFixed(1)}%
                {row.skipped > 0 && ` · bỏ qua ${row.skipped}`}
            </p>
            {row.isWeak && (
                <p className="mt-1 text-xs font-medium text-amber-600">Cần ôn thêm</p>
            )}
        </div>
    )
}

export default function PartAccuracyChart({ items, weakParts }: PartAccuracyChartProps) {
    const rows: PartRow[] = items.map((item) => ({
        ...item,
        label: formatPartLabel(item.part),
        skill: partSkillLabel(item.part),
        isWeak: weakParts.includes(item.part),
    }))

    return (
        <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rows} margin={{ top: 20, right: 12, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_INK.grid} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: CHART_INK.axis }}
                        tickLine={false}
                        axisLine={{ stroke: CHART_INK.grid }}
                    />
                    <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        unit="%"
                        tick={{ fontSize: 11, fill: CHART_INK.axis }}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                    />
                    <Tooltip content={<PartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    {/* barSize nhỏ + bo góc trên: cột mảnh đọc dễ hơn cột béo */}
                    <Bar dataKey="accuracyPercent" barSize={38} radius={[4, 4, 0, 0]}>
                        {/* Nhãn số ngay trên cột — không cần rê chuột vẫn đọc được giá trị */}
                        <LabelList
                            dataKey="accuracyPercent"
                            position="top"
                            formatter={(v) => (v == null ? '' : `${Math.round(Number(v))}%`)}
                            style={{ fontSize: 11, fill: CHART_INK.axis }}
                        />
                        {rows.map((row) => (
                            <Cell
                                key={row.part}
                                fill={row.isWeak ? CHART_STATUS.warning : CHART_SERIES.total}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
