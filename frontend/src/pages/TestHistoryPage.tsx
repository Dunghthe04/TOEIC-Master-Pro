/**
 * Lịch sử thi — Day 31 Bước 5.
 * Danh sách mọi lần đã nộp; bấm dòng → xem lại kết quả.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TestSessionService } from '@/services/test-session.service'
import type { TestSessionHistoryItem } from '@/types/test-session.types'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, History } from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 15

function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

function partsLabel(parts: number[] | null): string {
    if (!parts?.length) return 'Full test'
    return `Part ${parts.join(', ')}`
}

export default function TestHistoryPage() {
    const navigate = useNavigate()
    const [search] = useSearchParams()
    const filterTestId = search.get('testId') ?? undefined

    const [items, setItems] = useState<TestSessionHistoryItem[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await TestSessionService.getHistory({
                testId: filterTestId,
                page,
                pageSize: PAGE_SIZE,
            })
            setItems(data.items)
            setTotal(data.total)
        } catch {
            toast.error('Không tải được lịch sử thi.')
        } finally {
            setLoading(false)
        }
    }, [filterTestId, page])

    useEffect(() => {
        load()
    }, [load])

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
    const filterTitle = items[0]?.testTitle

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#eef2f6] to-white px-4 py-8 md:py-10">
            <div className="mx-auto w-full max-w-4xl space-y-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground -ml-2"
                    onClick={() => navigate(filterTestId ? `/mock-test/${filterTestId}` : '/mock-test')}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {filterTestId ? 'Về cấu trúc đề' : 'Danh sách đề'}
                </Button>

                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center gap-2 text-[#1a4d7c]">
                        <History className="w-7 h-7" />
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Lịch sử thi
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {filterTestId && filterTitle
                            ? `Đề ${filterTitle} — ${total} lần đã nộp`
                            : `Tất cả lần thi — ${total} bản ghi`}
                    </p>
                </div>

                <div className="rounded-xl border-2 border-[#1a4d7c]/20 bg-white shadow-lg overflow-hidden">
                    <div className="bg-[#1a4d7c] text-white px-6 md:px-8 py-4 text-center">
                        <p className="font-semibold tracking-wide uppercase text-sm md:text-base">
                            Các lần đã nộp bài
                        </p>
                    </div>

                    {loading ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            Đang tải…
                        </p>
                    ) : items.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">
                            Chưa có lần thi nào đã nộp.
                            <Button
                                variant="link"
                                className="block mx-auto mt-2"
                                onClick={() => navigate('/mock-test')}
                            >
                                Làm đề thử ngay
                            </Button>
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="px-4 md:px-6">Thời gian</TableHead>
                                    {!filterTestId && (
                                        <TableHead className="px-4 md:px-6">Đề</TableHead>
                                    )}
                                    <TableHead className="px-4 md:px-6">Phạm vi</TableHead>
                                    <TableHead className="px-4 md:px-6 text-right">Điểm</TableHead>
                                    <TableHead className="px-4 md:px-6 w-24" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((row) => (
                                    <TableRow
                                        key={row.sessionId}
                                        className="cursor-pointer hover:bg-slate-50/80"
                                        onClick={() =>
                                            navigate(`/mock-test/history/${row.sessionId}`)
                                        }
                                    >
                                        <TableCell className="px-4 md:px-6 py-4 text-sm">
                                            {formatDateTime(row.completedAt)}
                                        </TableCell>
                                        {!filterTestId && (
                                            <TableCell className="px-4 md:px-6 py-4">
                                                <span className="font-medium text-[#1a4d7c]">
                                                    {row.testTitle}
                                                </span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {row.testSeries}
                                                </span>
                                            </TableCell>
                                        )}
                                        <TableCell className="px-4 md:px-6 py-4">
                                            <Badge variant="secondary" className="font-normal">
                                                {partsLabel(row.partsFilter)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 md:px-6 py-4 text-right tabular-nums">
                                            {row.totalScore != null ? (
                                                <span className="font-bold text-lg text-[#1a4d7c]">
                                                    {row.totalScore}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">
                                                    {row.listeningScore != null &&
                                                        `L ${row.listeningScore}`}
                                                    {row.listeningScore != null &&
                                                        row.readingScore != null &&
                                                        ' · '}
                                                    {row.readingScore != null &&
                                                        `R ${row.readingScore}`}
                                                </span>
                                            )}
                                            <span className="block text-xs text-muted-foreground">
                                                {row.correctCount}/{row.totalCount} câu đúng
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-4 md:px-6 py-4">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Xem lại"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    navigate(
                                                        `/mock-test/history/${row.sessionId}`
                                                    )
                                                }}
                                            >
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Trang {page}/{totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
