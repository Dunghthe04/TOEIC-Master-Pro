/**
 * TestQuestionsPage — CM gán / gỡ câu hỏi vào đề.
 * Mục đích: không cần Scalar; tick câu từ kho → AddQuestions API.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import { QuestionService } from '@/services/question.service'
import type { TestDetail } from '@/types/test.types'
import type { QuestionResponse, TestImportDryRunReport } from '@/types/question.types'
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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Link2, Trash2, Upload, FileSpreadsheet, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { uploadAudio, uploadImage } from '@/services/media.service'
import { getMediaUrl, prefetchMediaToken } from '@/lib/media'
import { buildAudioFileName, toExamCode, toTestCode } from '@/lib/toeicMediaNaming'

/**
 * Một khối danh sách trong báo cáo chạy thử.
 *
 * Cắt còn 12 phần tử: danh sách 100 số OrderIndex làm hộp thoại dài vô ích, mà thứ cần đọc
 * chỉ là "có bao nhiêu" và "trông như thế nào". Số đầy đủ vẫn hiện trong ngoặc.
 */
function ReportList({ label, items, tone = 'muted' }: {
    label: string
    items: (string | number)[]
    tone?: 'muted' | 'warn'
}) {
    if (items.length === 0) return null
    const shown = items.slice(0, 12)

    return (
        <div className={
            tone === 'warn'
                ? 'rounded-md border border-destructive/40 bg-destructive/5 p-2'
                : 'rounded-md border p-2'
        }>
            <p className="font-medium">
                {label} <span className="text-muted-foreground">({items.length})</span>
            </p>
            <p className="mt-1 font-mono text-xs break-words text-muted-foreground">
                {shown.join(', ')}
                {items.length > shown.length ? ` … +${items.length - shown.length}` : ''}
            </p>
        </div>
    )
}

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
    const [uploadingMedia, setUploadingMedia] = useState(false)
    const [lastUploaded, setLastUploaded] = useState<string[]>([])
    const audioInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const packInputRef = useRef<HTMLInputElement>(null)
    const [importingPack, setImportingPack] = useState(false)
    const [checkingPack, setCheckingPack] = useState(false)
    // Báo cáo chạy thử + chính file đã chạy thử. Giữ file lại để lần import thật dùng
    // ĐÚNG file đó — không phải đọc lại từ input (input đã bị clear, và người dùng có thể
    // đã chọn file khác trong lúc xem báo cáo).
    const [dryRun, setDryRun] = useState<TestImportDryRunReport | null>(null)
    const [pendingPack, setPendingPack] = useState<File | null>(null)
    const [previewPart, setPreviewPart] = useState<string>('1')

    const load = useCallback(async () => {
        if (!id) return
        setLoading(true)
        try {
            // Xin token media TRƯỚC khi setDetail() gây render <audio>/<img>.
            // Thẻ media do trình duyệt tải nên không gắn Authorization header được —
            // token phải nằm trong query string và có sẵn lúc getMediaUrl() build URL.
            // CM/Admin xin được token cả đề nháp (backend kiểm role).
            await prefetchMediaToken(id)

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

    /** Upload nhiều file audio/ảnh vào thư mục của đề (giữ tên file). */
    const handleBulkMedia = async (
        files: FileList | null,
        kind: 'audio' | 'image'
    ) => {
        if (!id || !files?.length) return
        setUploadingMedia(true)
        const done: string[] = []
        let fail = 0
        try {
            for (const file of Array.from(files)) {
                try {
                    const res =
                        kind === 'audio'
                            ? await uploadAudio(file, id)
                            : await uploadImage(file, id)
                    done.push(res.url)
                } catch {
                    fail++
                }
            }
            setLastUploaded(done)
            if (done.length) toast.success(`Đã upload ${done.length} file.`)
            if (fail) toast.error(`${fail} file lỗi.`)
        } finally {
            setUploadingMedia(false)
        }
    }

    /**
     * Bước 1 — CHẠY THỬ. Server đọc gói, kiểm hết, rồi dừng: không tạo câu, không gán vào
     * đề, không giải nén media.
     *
     * VÌ SAO KHÔNG IMPORT LUÔN: import ghi câu theo OrderIndex, trùng thì THAY câu cũ. Chọn
     * nhầm gói (Test1.zip vào đề Test 3) hoặc thiếu file audio đều không sinh lỗi nào —
     * import báo "100 câu thành công" trong khi đề đã bị thay sạch, hoặc câu mất tiếng. Xem
     * báo cáo trước, ghi sau.
     */
    const handlePickPack = async (files: FileList | null) => {
        if (!id || !files?.[0]) return
        const file = files[0]
        setCheckingPack(true)
        try {
            const report = await TestService.importListeningDryRun(id, file)
            setDryRun(report)
            setPendingPack(file)
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Không đọc được gói'
            toast.error(msg)
        } finally {
            setCheckingPack(false)
        }
    }

    /** Bước 2 — import THẬT, dùng đúng file vừa chạy thử. */
    const handleConfirmImport = async () => {
        if (!id || !pendingPack) return
        setImportingPack(true)
        try {
            const res = await TestService.importListening(id, pendingPack)
            toast.success(
                `Import ${res.import.successCount} câu · gán ${res.assignedToTest} vào đề`
            )
            setDryRun(null)
            setPendingPack(null)
            await load()
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Import thất bại'
            toast.error(msg)
        } finally {
            setImportingPack(false)
        }
    }

    const handleAssignListeningBulk = async () => {
        if (!id) return
        try {
            const res = await TestService.assignListeningBulk(id)
            toast.success(`Đã gán thêm ${res.assigned} câu Listening.`)
            await load()
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error
                ?? 'Gán thất bại'
            toast.error(msg)
        }
    }

    const downloadTemplate = async () => {
        try {
            const blob = await QuestionService.downloadImportTemplate()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'toeic-questions-template.xlsx'
            a.click()
            URL.revokeObjectURL(url)
        } catch {
            toast.error('Không tải được file mẫu.')
        }
    }

    /** Câu trong đề — lọc Part 1–4 cho preview. */
    const listeningInTest = useMemo(() => {
        if (!detail) return []
        return [...detail.questions]
            .filter((q) => {
                const n = Number(String(q.part).replace(/\D/g, ''))
                return n >= 1 && n <= 4
            })
            .sort((a, b) => a.orderIndex - b.orderIndex)
    }, [detail])

    const previewQuestions = useMemo(
        () => listeningInTest.filter((q) => Number(String(q.part).replace(/\D/g, '')) === Number(previewPart)),
        [listeningInTest, previewPart]
    )

    /** Nhóm Part 3–4 theo audioUrl. */
    const previewGroups = useMemo(() => {
        const groups: { audioUrl: string | null; items: typeof previewQuestions }[] = []
        for (const q of previewQuestions) {
            const last = groups[groups.length - 1]
            if (last && last.audioUrl === q.audioUrl) last.items.push(q)
            else groups.push({ audioUrl: q.audioUrl, items: [q] })
        }
        return groups
    }, [previewQuestions])

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
                    <br />
                    <span className="text-xs">
                        Quy ước audio:{' '}
                        <code>
                            {toExamCode(detail.series)}-{toTestCode(detail.title)}-{'{n}'}.mp3
                        </code>
                        {' '}(P1–2) hoặc{' '}
                        <code>
                            {toExamCode(detail.series)}-{toTestCode(detail.title)}-{'{đầu}'}-{'{cuối}'}.mp3
                        </code>
                        {' '}(P3–4, vd. {buildAudioFileName(detail.series, detail.title, 3, 38)})
                    </span>
                </p>
            </div>

            {/* Import gói Listening — ZIP hoặc Excel */}
            <section className="space-y-3 rounded-lg border p-4 border-primary/30">
                <h2 className="font-semibold">Import Listening Part 1–4</h2>
                <p className="text-sm text-muted-foreground">
                    Excel: cột <code>OrderIndex</code> bắt buộc. Import lại cùng số câu sẽ <strong>thay</strong> câu cũ (không trùng).
                    <br />
                    Chọn file sẽ <strong>kiểm trước</strong> — chưa ghi gì vào đề cho tới khi bạn xác nhận.
                </p>
                <div className="flex flex-wrap gap-2">
                    <input
                        ref={packInputRef}
                        type="file"
                        accept=".zip,.xlsx"
                        className="hidden"
                        onChange={(e) => {
                            void handlePickPack(e.target.files)
                            e.target.value = ''
                        }}
                    />
                    <Button
                        variant="default"
                        size="sm"
                        disabled={checkingPack || importingPack}
                        onClick={() => packInputRef.current?.click()}
                    >
                        <FileSpreadsheet className="w-4 h-4 mr-1" />
                        {checkingPack ? 'Đang kiểm gói…' : importingPack ? 'Đang import…' : 'Chọn ZIP / Excel'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void downloadTemplate()}>
                        <Download className="w-4 h-4 mr-1" />
                        Tải Excel mẫu
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => void handleAssignListeningBulk()}>
                        Gán nhanh Part 1–4 (kho)
                    </Button>
                </div>
            </section>

            {/* Upload lẻ — dùng khi chỉ bổ sung vài file, luồng chính là import ZIP */}
            <section className="space-y-3 rounded-lg border p-4 bg-muted/30">
                <h2 className="font-semibold">Upload media lẻ (tùy chọn)</h2>
                <p className="text-sm text-muted-foreground">
                    File lưu tại <code className="text-xs">/uploads/tests/{id}/audio/</code> —
                    đặt tên theo quy ước (vd. <code>{buildAudioFileName(detail.series, detail.title, 1, 1)}</code>).
                </p>
                <div className="flex flex-wrap gap-3">
                    <input
                        ref={audioInputRef}
                        type="file"
                        multiple
                        accept="audio/mpeg,audio/wav,.mp3,.wav,.m4a"
                        className="hidden"
                        disabled={uploadingMedia}
                        onChange={(e) => {
                            void handleBulkMedia(e.target.files, 'audio')
                            e.target.value = ''
                        }}
                    />
                    <input
                        ref={imageInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        disabled={uploadingMedia}
                        onChange={(e) => {
                            void handleBulkMedia(e.target.files, 'image')
                            e.target.value = ''
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingMedia}
                        onClick={() => audioInputRef.current?.click()}
                    >
                        <Upload className="w-4 h-4 mr-1" />
                        {uploadingMedia ? 'Đang upload…' : 'Chọn audio (nhiều file)'}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingMedia}
                        onClick={() => imageInputRef.current?.click()}
                    >
                        <Upload className="w-4 h-4 mr-1" />
                        Chọn ảnh Part 1
                    </Button>
                </div>
                {lastUploaded.length > 0 && (
                    <ul className="text-xs font-mono space-y-1 max-h-32 overflow-auto">
                        {lastUploaded.map((u) => (
                            <li key={u} className="text-muted-foreground">{u}</li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Preview Listening trong đề */}
            {listeningInTest.length > 0 && (
                <section className="space-y-3 rounded-lg border p-4">
                    <h2 className="font-semibold">Xem trước Listening ({listeningInTest.length} câu)</h2>
                    <div className="flex gap-2">
                        {['1', '2', '3', '4'].map((p) => (
                            <Button
                                key={p}
                                size="sm"
                                variant={previewPart === p ? 'default' : 'outline'}
                                onClick={() => setPreviewPart(p)}
                            >
                                Part {p}
                            </Button>
                        ))}
                    </div>
                    <div className="space-y-3 max-h-80 overflow-auto">
                        {previewGroups.map((g, i) => (
                            <div key={i} className="rounded border p-3 space-y-2 text-sm">
                                {g.audioUrl ? (
                                    <audio controls preload="none" src={getMediaUrl(g.audioUrl)} className="w-full" />
                                ) : (
                                    <p className="text-destructive text-xs">⚠ Thiếu audio</p>
                                )}
                                {g.items.map((q) => (
                                    <div key={q.questionId} className="flex flex-col gap-2">
                                        <div className="flex gap-2 items-start">
                                            <Badge variant="outline">#{q.orderIndex}</Badge>
                                            <span>{plainText(q.content, 120) || '(Part 1 — ảnh + audio)'}</span>
                                        </div>
                                        {q.imageUrl && previewPart === '1' && (
                                            <img
                                                src={getMediaUrl(q.imageUrl)}
                                                alt=""
                                                className="max-h-40 rounded border object-contain"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>
            )}

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

            {/* ── Hộp xác nhận import: nội dung là báo cáo chạy thử ──────────────────
                Mở ngay khi chọn file, TRƯỚC khi có gì được ghi. Người dùng đọc "sẽ tạo bao
                nhiêu câu, THAY câu nào, thiếu file nào" rồi mới quyết định. */}
            <AlertDialog
                open={dryRun !== null}
                onOpenChange={(open) => {
                    // Không cho đóng giữa lúc đang import — đóng lúc đó chỉ làm mất thông tin
                    // trên màn hình, request vẫn chạy tiếp ở server.
                    if (!open && !importingPack) {
                        setDryRun(null)
                        setPendingPack(null)
                    }
                }}
            >
                <AlertDialogContent className="data-[size=default]:max-w-2xl data-[size=default]:sm:max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            {dryRun?.ok
                                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                : <AlertTriangle className="h-5 w-5 text-destructive" />}
                            Kiểm gói trước khi import
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {dryRun?.summary} Chưa có gì được ghi vào đề.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {dryRun && (
                        <div className="max-h-[55vh] space-y-3 overflow-y-auto text-sm">
                            <div className="rounded-md border p-2">
                                <p className="font-medium">Gói</p>
                                <p className="text-xs text-muted-foreground">
                                    <code>{pendingPack?.name}</code>
                                    {' · '}{((pendingPack?.size ?? 0) / 1048576).toFixed(1)} MB
                                    {dryRun.sections.length > 0 && ` · ${dryRun.sections.join(' + ')}`}
                                </p>
                                {dryRun.manifest ? (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        manifest: {dryRun.manifest.series} · {dryRun.manifest.title}
                                        {dryRun.manifest.source && ` · ${dryRun.manifest.source}`}
                                    </p>
                                ) : (
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Không có manifest.json — không đối chiếu được gói với đề.
                                    </p>
                                )}
                            </div>

                            <div className="rounded-md border p-2">
                                <p className="font-medium">Số câu</p>
                                <p className="text-xs text-muted-foreground">
                                    {dryRun.rows.total} dòng · <strong>{dryRun.rows.valid}</strong> sẽ tạo
                                    {dryRun.rows.invalid > 0 && ` · ${dryRun.rows.invalid} dòng lỗi`}
                                    {dryRun.orderIndex.min !== null &&
                                        ` · vị trí ${dryRun.orderIndex.min}–${dryRun.orderIndex.max}`}
                                </p>
                            </div>

                            {/* Khối đáng đọc nhất: import này PHÁ MẤT gì. */}
                            <ReportList
                                label="Vị trí đang có câu và SẼ BỊ THAY"
                                items={dryRun.willReplace}
                                tone="warn"
                            />
                            <ReportList
                                label="Dòng Excel lỗi"
                                items={dryRun.errors.map(e => `dòng ${e.row}: ${e.reason}`)}
                                tone="warn"
                            />
                            <ReportList
                                label="OrderIndex TRÙNG — dòng sau sẽ đè dòng trước"
                                items={dryRun.orderIndex.duplicates}
                                tone="warn"
                            />
                            <ReportList
                                label="Audio gói không có — câu sẽ mất tiếng"
                                items={dryRun.media.audioMissing}
                                tone="warn"
                            />
                            <ReportList
                                label="Ảnh gói không có"
                                items={dryRun.media.imageMissing}
                                tone="warn"
                            />

                            <ReportList label="Vị trí bị thiếu trong dải" items={dryRun.orderIndex.missing} />
                            <ReportList label="File trong gói không câu nào dùng" items={dryRun.media.unusedInPackage} />

                            <p className="text-xs text-muted-foreground">
                                {dryRun.media.checked
                                    ? `Đối chiếu media: ${dryRun.media.audioReferenced} audio, ${dryRun.media.imageReferenced} ảnh được tham chiếu.`
                                    : dryRun.media.note}
                            </p>
                        </div>
                    )}

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={importingPack}>Hủy</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={importingPack}
                            onClick={(e) => {
                                // Chặn hành vi mặc định của Radix (đóng ngay khi bấm) để hộp
                                // thoại còn hiện được trạng thái "đang import".
                                e.preventDefault()
                                void handleConfirmImport()
                            }}
                        >
                            {importingPack
                                ? 'Đang import…'
                                : dryRun?.ok
                                    ? `Import thật (${dryRun.rows.valid} câu)`
                                    : 'Import dù có lỗi'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
