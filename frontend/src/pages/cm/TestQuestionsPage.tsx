/**
 * TestQuestionsPage — CM gán / gỡ câu hỏi vào đề.
 * Mục đích: không cần Scalar; tick câu từ kho → AddQuestions API.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import { QuestionService } from '@/services/question.service'
import type { TestDetail } from '@/types/test.types'
import type { QuestionResponse } from '@/types/question.types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Link2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

/** Bỏ HTML TipTap để xem nhanh trong bảng. */
function plainText(html: string, max = 72): string {
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return t.length > max ? t.slice(0, max) + '…' : t
}

/** Part API có thể là số 1 hoặc "Part1". */
function partLabel(part: string | number): string {
    if (typeof part === 'number') return `Part ${part}`
    const n = String(part).replace(/\D/g, '')
    return n ? `Part ${n}` : String(part)
}

export default function TestQuestionsPage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<TestDetail | null>(null)
    const [bank, setBank] = useState<QuestionResponse[]>([])
    const [loading, setLoading] = useState(true)
    const [partFilter, setPartFilter] = useState<string>('all')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        if (!id) return
        setLoading(true)
        try {
            const [d, qs] = await Promise.all([
                TestService.getById(id),
                QuestionService.getList(),
            ])
            setDetail(d)
            setBank(qs)
            setSelected(new Set())
        } catch {
            toast.error('Không tải được đề / kho câu hỏi.')
            navigate('/cm/tests')
        } finally {
            setLoading(false)
        }
    }, [id, navigate])

    useEffect(() => {
        void load()
    }, [load])

    const assignedIds = useMemo(
        () => new Set(detail?.questions.map((q) => q.questionId) ?? []),
        [detail]
    )

    /** Kho câu chưa gắn đề, lọc Part + tìm kiếm. */
    const available = useMemo(() => {
        return bank.filter((q) => {
            if (assignedIds.has(q.id)) return false
            if (partFilter !== 'all') {
                const n =
                    typeof q.part === 'number'
                        ? q.part
                        : Number(String(q.part).replace(/\D/g, ''))
                if (String(n) !== partFilter) return false
            }
            if (search.trim()) {
                const hay = plainText(q.content, 500).toLowerCase()
                if (!hay.includes(search.toLowerCase())) return false
            }
            return true
        })
    }, [bank, assignedIds, partFilter, search])

    const toggle = (qid: string, on: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev)
            if (on) next.add(qid)
            else next.delete(qid)
            return next
        })
    }

    /** Gán các câu đã tick; OrderIndex tiếp nối max hiện có. */
    const handleAdd = async () => {
        if (!id || !detail || selected.size === 0) return
        setSaving(true)
        try {
            const maxOrder =
                detail.questions.reduce((m, q) => Math.max(m, q.orderIndex), 0) || 0
            let order = maxOrder
            const items = [...selected].map((questionId) => {
                order += 1
                return { questionId, orderIndex: order }
            })
            await TestService.addQuestions(id, { items })
            toast.success(`Đã gán ${items.length} câu vào đề.`)
            await load()
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data
                    ?.error ?? 'Gán câu thất bại'
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    const handleRemove = async (questionId: string) => {
        if (!id) return
        try {
            await TestService.removeQuestion(id, questionId)
            toast.success('Đã gỡ câu khỏi đề.')
            await load()
        } catch {
            toast.error('Gỡ câu thất bại.')
        }
    }

    if (loading || !detail) {
        return (
            <div className="p-6 text-sm text-muted-foreground">Đang tải…</div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl">
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/cm/tests')}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Danh sách đề
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/cm/tests/${id}/edit`)}
                >
                    Sửa thông tin đề
                </Button>
            </div>

            <div>
                <h1 className="text-2xl font-bold">Gán câu hỏi</h1>
                <p className="text-sm text-muted-foreground">
                    {detail.title} · đã gắn{' '}
                    <strong>{detail.questions.length}</strong> câu
                    {detail.isPublished ? ' · Đã xuất bản' : ' · Nháp'}
                </p>
            </div>

            {/* Câu đã trong đề */}
            <section className="space-y-2">
                <h2 className="font-semibold">Câu trong đề</h2>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">#</TableHead>
                                <TableHead className="w-24">Part</TableHead>
                                <TableHead>Nội dung</TableHead>
                                <TableHead className="w-24 text-right">Gỡ</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detail.questions.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={4}
                                        className="text-center text-muted-foreground"
                                    >
                                        Chưa có câu — chọn bên dưới rồi bấm Gán vào đề.
                                    </TableCell>
                                </TableRow>
                            )}
                            {[...detail.questions]
                                .sort((a, b) => a.orderIndex - b.orderIndex)
                                .map((q) => (
                                    <TableRow key={q.questionId}>
                                        <TableCell>{q.orderIndex}</TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">
                                                {partLabel(q.part)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {plainText(q.content)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemove(q.questionId)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>
                </div>
            </section>

            {/* Kho câu để thêm */}
            <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold">Kho câu hỏi (chưa gắn)</h2>
                    <Button
                        disabled={selected.size === 0 || saving}
                        onClick={() => void handleAdd()}
                    >
                        <Link2 className="w-4 h-4 mr-2" />
                        {saving ? 'Đang gán…' : `Gán vào đề (${selected.size})`}
                    </Button>
                </div>

                <div className="flex flex-wrap gap-3">
                    <Input
                        placeholder="Tìm nội dung…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="max-w-xs"
                    />
                    <Select value={partFilter} onValueChange={setPartFilter}>
                        <SelectTrigger className="w-36">
                            <SelectValue placeholder="Part" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tất cả Part</SelectItem>
                            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    Part {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="rounded-md border max-h-[420px] overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12" />
                                <TableHead className="w-24">Part</TableHead>
                                <TableHead>Nội dung</TableHead>
                                <TableHead className="w-28">Trạng thái</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {available.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={4}
                                        className="text-center text-muted-foreground"
                                    >
                                        Không còn câu phù hợp (hoặc kho trống).
                                    </TableCell>
                                </TableRow>
                            )}
                            {available.map((q) => {
                                const checked = selected.has(q.id)
                                return (
                                    <TableRow key={q.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(v) =>
                                                    toggle(q.id, v === true)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {partLabel(q.part)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {plainText(q.content)}
                                        </TableCell>
                                        <TableCell>
                                            {q.isPublished ? (
                                                <Badge>Published</Badge>
                                            ) : (
                                                <Badge variant="secondary">Nháp</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    )
}
