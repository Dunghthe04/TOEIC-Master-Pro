/**
 * MockTestPage — danh sách đề thi thử (Exam Engine Day 27).
 * Mục đích: gọi GET /api/test/published, gom theo series, chọn đề → /mock-test/:id
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import type { TestSummary } from '@/types/test.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { ClipboardList, Clock, FileQuestion } from 'lucide-react'
import { toast } from 'sonner'

/** Gom list phẳng thành Map series → danh sách đề (giống accordion Zenlish). */
function groupBySeries(tests: TestSummary[]): Map<string, TestSummary[]> {
    const map = new Map<string, TestSummary[]>()
    for (const t of tests) {
        const key = t.series?.trim() || 'Khác'
        const list = map.get(key) ?? []
        list.push(t)
        map.set(key, list)
    }
    return map
}

export default function MockTestPage() {
    const navigate = useNavigate()
    const [tests, setTests] = useState<TestSummary[]>([])
    const [loading, setLoading] = useState(true)
    // series đang xem — null = hiện tất cả series
    const [activeSeries, setActiveSeries] = useState<string | null>(null)

    /** Load đề published cho User (không lấy draft CM). */
    const loadPublished = async () => {
        setLoading(true)
        try {
            const data = await TestService.getPublished()
            setTests(data)
        } catch {
            toast.error('Không tải được danh sách đề. Kiểm tra đăng nhập / API.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadPublished()
    }, [])

    const grouped = useMemo(() => groupBySeries(tests), [tests])
    const seriesKeys = useMemo(() => [...grouped.keys()], [grouped])

    // Đề đang hiển thị: lọc theo tab series (nếu có chọn)
    const visibleEntries = useMemo(() => {
        if (!activeSeries) return [...grouped.entries()]
        const list = grouped.get(activeSeries) ?? []
        return [[activeSeries, list] as [string, TestSummary[]]]
    }, [grouped, activeSeries])

    /** Chọn đề → màn cấu trúc Part (Bước 3). */
    const openStructure = (testId: string) => {
        navigate(`/mock-test/${testId}`)
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList className="w-7 h-7" />
                    Thi thử TOEIC
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Chọn series → chọn đề → full test hoặc từng Part (giống đề thật).
                </p>
            </div>

            {/* Tab lọc series */}
            {seriesKeys.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="sm"
                        variant={activeSeries === null ? 'default' : 'outline'}
                        onClick={() => setActiveSeries(null)}
                    >
                        Tất cả
                    </Button>
                    {seriesKeys.map((s) => (
                        <Button
                            key={s}
                            size="sm"
                            variant={activeSeries === s ? 'default' : 'outline'}
                            onClick={() => setActiveSeries(s)}
                        >
                            {s}
                        </Button>
                    ))}
                </div>
            )}

            {loading && (
                <p className="text-sm text-muted-foreground">Đang tải đề…</p>
            )}

            {!loading && tests.length === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Chưa có đề published</CardTitle>
                        <CardDescription>
                            CM cần tạo đề, gán câu hỏi, bật Published — rồi quay lại đây.
                        </CardDescription>
                    </CardHeader>
                </Card>
            )}

            {!loading &&
                visibleEntries.map(([series, list]) => (
                    <section key={series} className="space-y-3">
                        <h2 className="text-lg font-semibold border-b pb-1">{series}</h2>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {list.map((t) => (
                                <Card
                                    key={t.id}
                                    className="cursor-pointer transition hover:border-primary/60 hover:shadow-sm"
                                    onClick={() => openStructure(t.id)}
                                >
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base leading-snug">
                                            {t.title}
                                        </CardTitle>
                                        {t.description && (
                                            <CardDescription className="line-clamp-2">
                                                {t.description}
                                            </CardDescription>
                                        )}
                                    </CardHeader>
                                    <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="gap-1 font-normal">
                                            <Clock className="w-3 h-3" />
                                            {t.durationMinutes}′
                                        </Badge>
                                        <Badge variant="outline" className="gap-1 font-normal">
                                            <FileQuestion className="w-3 h-3" />
                                            {t.questionCount} câu
                                        </Badge>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </section>
                ))}
        </div>
    )
}