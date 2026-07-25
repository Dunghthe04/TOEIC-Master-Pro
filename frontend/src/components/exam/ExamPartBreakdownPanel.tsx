/**
 * Phân tích kết quả theo Part — Day 30 Phần 3.
 * Bảng + thanh %; highlight Part accuracy thấp nhất.
 */
import { AlertTriangle, BarChart3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    accuracyBarColor,
    formatPartLabel,
    getWeakestPartNumbers,
    partSkillLabel,
} from '@/lib/partBreakdown'
import { cn } from '@/lib/utils'
import type { PartBreakdownItem } from '@/types/test-session.types'

type ExamPartBreakdownPanelProps = {
    items: PartBreakdownItem[]
}

export default function ExamPartBreakdownPanel({ items }: ExamPartBreakdownPanelProps) {
    if (items.length === 0) return null

    const weakestParts = getWeakestPartNumbers(items)
    const showWeakestCallout = items.length > 1
    const weakestLabel = weakestParts.map(formatPartLabel).join(', ')

    return (
        <Card className="w-full max-w-5xl mx-auto mt-8 border-[#1a4d7c]/20 shadow-md">
            <CardHeader className="border-b border-border/60 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-[#1a4d7c]">
                            <BarChart3 className="size-5 shrink-0" aria-hidden />
                            Phân tích theo Part
                        </CardTitle>
                        <CardDescription className="mt-1">
                            Tỷ lệ đúng trên số câu trong phạm vi bài thi (câu bỏ qua tính vào tổng).
                        </CardDescription>
                    </div>
                    {showWeakestCallout && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                            <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden />
                            <span>
                                Part cần ôn thêm:{' '}
                                <strong className="font-semibold">{weakestLabel}</strong>
                                {' '}(
                                {items
                                    .find((i) => i.part === weakestParts[0])
                                    ?.accuracyPercent.toFixed(1)}
                                %)
                            </span>
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-6">
                {/* Biểu đồ thanh ngang — không cần Recharts (Day 32 dashboard) */}
                <div className="space-y-3" aria-label="Biểu đồ tỷ lệ đúng theo Part">
                    {items.map((item) => {
                        const isWeakest = weakestParts.includes(item.part)
                        return (
                            <div key={item.part} className="grid grid-cols-[72px_1fr_52px] items-center gap-3">
                                <span
                                    className={cn(
                                        'text-xs font-semibold tabular-nums',
                                        isWeakest && items.length > 1
                                            ? 'text-amber-700'
                                            : 'text-gray-700',
                                    )}
                                >
                                    {formatPartLabel(item.part)}
                                </span>
                                <div className="relative h-3 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full transition-all',
                                            accuracyBarColor(item.accuracyPercent),
                                            isWeakest && items.length > 1 && 'ring-2 ring-amber-400 ring-offset-1',
                                        )}
                                        style={{ width: `${Math.min(100, item.accuracyPercent)}%` }}
                                    />
                                </div>
                                <span className="text-xs font-medium text-gray-800 tabular-nums text-right">
                                    {item.accuracyPercent.toFixed(1)}%
                                </span>
                            </div>
                        )
                    })}
                </div>

                {/* Bảng chi tiết */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Part</TableHead>
                            <TableHead>Kỹ năng</TableHead>
                            <TableHead className="text-right">Đúng / Tổng</TableHead>
                            <TableHead className="text-right">Bỏ qua</TableHead>
                            <TableHead className="text-right">Tỷ lệ</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => {
                            const isWeakest = weakestParts.includes(item.part)
                            return (
                                <TableRow
                                    key={item.part}
                                    className={cn(
                                        isWeakest && items.length > 1 && 'bg-amber-50/80 hover:bg-amber-50',
                                    )}
                                >
                                    <TableCell className="font-medium">
                                        <span className="inline-flex items-center gap-2">
                                            {formatPartLabel(item.part)}
                                            {isWeakest && items.length > 1 && (
                                                <Badge
                                                    variant="outline"
                                                    className="border-amber-300 bg-amber-100 text-amber-900 text-[10px]"
                                                >
                                                    Yếu nhất
                                                </Badge>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {partSkillLabel(item.part)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {item.correct} / {item.total}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {item.skipped > 0 ? item.skipped : '—'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums font-medium">
                                        {item.accuracyPercent.toFixed(1)}%
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
