/**
 * Nội dung hệ thống — /admin/content. Chỉ Admin, CHỈ XEM.
 *
 * VÌ SAO CHỈ XEM: phân vai đã chốt là "CM soạn nội dung, Admin là sếp xem tổng quan".
 * Backend chặn thật — POST/PUT/DELETE trên đề thi, câu hỏi, từ vựng, lịch thi đều là
 * [Authorize(Roles="ContentManager")], token Admin gọi vào nhận 403. Nên trang này
 * KHÔNG có nút tạo/sửa/xoá: bày nút ra rồi để nó ăn 403 là hứa thứ không làm được.
 *
 * Ngược lại, các endpoint GET đã mở "ContentManager,Admin" từ trước (TestController,
 * QuestionController) hoặc mở rộng hơn (VocabularyController: "User,ContentManager,Admin",
 * ExamScheduleController GET: [AllowAnonymous]) → trang này không cần thêm API mới.
 *
 * Gộp 4 loại nội dung vào MỘT trang có tab thay vì 4 trang riêng: Admin cần cái nhìn
 * "hệ thống đang có gì", không phải đi lại giữa bốn màn hình để đếm.
 */
import { useCallback, useEffect, useState } from 'react'
import { Calendar, FileText, HelpCircle, Loader2, BookMarked, Search } from 'lucide-react'
import { toast } from 'sonner'
import { TestService } from '@/services/test.service'
import { QuestionService } from '@/services/question.service'
import { VocabularyService } from '@/services/vocabulary.service'
import { ExamScheduleService } from '@/services/exam-schedule.service'
import type { TestSummary } from '@/types/test.types'
import type { QuestionResponse } from '@/types/question.types'
import type { Vocabulary } from '@/types/vocabulary.types'
import type { ExamSchedule } from '@/types/exam-schedule.types'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'

type Tab = 'tests' | 'questions' | 'vocabulary' | 'schedules'

const TABS: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'tests', label: 'Đề thi', icon: FileText },
    { key: 'questions', label: 'Câu hỏi', icon: HelpCircle },
    { key: 'vocabulary', label: 'Từ vựng', icon: BookMarked },
    { key: 'schedules', label: 'Lịch thi', icon: Calendar },
]

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('vi-VN')
}

/** Bỏ thẻ HTML để hiện nội dung câu hỏi dạng chữ thuần trong bảng.
 *
 *  An toàn vì KHÔNG render bằng dangerouslySetInnerHTML — chuỗi trả về đi vào text node
 *  của React nên mọi ký tự đều được escape. Đây chỉ là cắt bớt cho gọn, không phải
 *  biện pháp chống XSS (chống XSS thật là HtmlContentSanitizer lúc GHI ở backend).
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function truncate(s: string, max = 90): string {
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export default function AdminContentPage() {
    const [tab, setTab] = useState<Tab>('tests')
    const [search, setSearch] = useState('')

    const [tests, setTests] = useState<TestSummary[] | null>(null)
    const [questions, setQuestions] = useState<QuestionResponse[] | null>(null)
    const [vocab, setVocab] = useState<Vocabulary[] | null>(null)
    const [schedules, setSchedules] = useState<ExamSchedule[] | null>(null)
    const [loading, setLoading] = useState(false)

    // Nạp theo tab và CHỈ nạp lần đầu của mỗi tab (state != null là đã có dữ liệu) —
    // đổi tab qua lại không gọi lại API. Lọc/tìm làm phía client vì các endpoint này
    // trả toàn bộ danh sách, không phân trang.
    const load = useCallback(async () => {
        setLoading(true)
        try {
            if (tab === 'tests' && tests === null) setTests(await TestService.getList())
            if (tab === 'questions' && questions === null) setQuestions(await QuestionService.getList())
            if (tab === 'vocabulary' && vocab === null) setVocab(await VocabularyService.getList())
            if (tab === 'schedules' && schedules === null) setSchedules(await ExamScheduleService.getList())
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Không tải được dữ liệu.')
        } finally {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab])

    useEffect(() => { load() }, [load])

    // Đổi tab thì xoá từ khoá cũ: "part 5" gõ ở tab Câu hỏi không có nghĩa gì ở tab Đề thi,
    // để lại thì bảng trông như rỗng và không hiểu vì sao.
    useEffect(() => { setSearch('') }, [tab])

    const q = search.trim().toLowerCase()

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Nội dung hệ thống</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Toàn bộ đề thi, câu hỏi, từ vựng và lịch thi — chỉ xem.
                    Việc soạn/sửa thuộc vai Quản lý nội dung.
                </p>
            </div>

            {/* ── Tab ────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-1 border-b">
                {TABS.map(({ key, label, icon: Icon }) => {
                    const count = key === 'tests' ? tests?.length
                        : key === 'questions' ? questions?.length
                        : key === 'vocabulary' ? vocab?.length
                        : schedules?.length
                    return (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                                tab === key
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={15} />
                            {label}
                            {/* Chỉ hiện số khi ĐÃ nạp — hiện 0 lúc chưa tải là nói sai
                                rằng hệ thống không có gì. */}
                            {count !== undefined && (
                                <span className="rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div className="relative max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={
                        tab === 'tests' ? 'Tìm theo tên đề hoặc series…'
                        : tab === 'questions' ? 'Tìm trong nội dung câu hỏi…'
                        : tab === 'vocabulary' ? 'Tìm từ hoặc nghĩa…'
                        : 'Tìm theo tên kỳ thi hoặc tỉnh/thành…'
                    }
                    className="pl-9"
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <p className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                            <Loader2 className="animate-spin" size={16} /> Đang tải…
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            {tab === 'tests' && (
                                <DataTable
                                    head={['Tên đề', 'Series', 'Số câu', 'Thời lượng', 'Trạng thái', 'Ngày tạo']}
                                    rows={(tests ?? [])
                                        .filter(t => !q
                                            || t.title.toLowerCase().includes(q)
                                            || t.series?.toLowerCase().includes(q))
                                        .map(t => ({
                                            key: t.id,
                                            cells: [
                                                <span className="font-medium text-gray-900">{t.title}</span>,
                                                t.series || '—',
                                                t.questionCount,
                                                `${t.durationMinutes} phút`,
                                                t.isPublished
                                                    ? <Badge className="bg-green-100 text-green-700">Đã xuất bản</Badge>
                                                    : <Badge variant="secondary">Nháp</Badge>,
                                                formatDate(t.createdAt),
                                            ],
                                        }))}
                                    empty="Chưa có đề thi nào."
                                />
                            )}

                            {tab === 'questions' && (
                                <DataTable
                                    head={['Nội dung', 'Part', 'Độ khó', 'Số đáp án', 'Trạng thái']}
                                    rows={(questions ?? [])
                                        .filter(x => !q || stripHtml(x.content).toLowerCase().includes(q))
                                        .map(x => ({
                                            key: x.id,
                                            cells: [
                                                <span className="text-gray-700">
                                                    {truncate(stripHtml(x.content)) || '(trống)'}
                                                </span>,
                                                `Part ${x.part}`,
                                                x.difficulty,
                                                x.options?.length ?? 0,
                                                x.isPublished
                                                    ? <Badge className="bg-green-100 text-green-700">Đã xuất bản</Badge>
                                                    : <Badge variant="secondary">Nháp</Badge>,
                                            ],
                                        }))}
                                    empty="Chưa có câu hỏi nào."
                                />
                            )}

                            {tab === 'vocabulary' && (
                                <DataTable
                                    head={['Từ', 'Phiên âm', 'Loại từ', 'Nghĩa', 'Chủ đề']}
                                    rows={(vocab ?? [])
                                        .filter(v => !q
                                            || v.word.toLowerCase().includes(q)
                                            || v.definition.toLowerCase().includes(q))
                                        .map(v => ({
                                            key: v.id,
                                            cells: [
                                                <span className="font-medium text-gray-900">{v.word}</span>,
                                                <span className="text-gray-500">{v.phonetic || '—'}</span>,
                                                v.wordType,
                                                truncate(v.definition, 60),
                                                <Badge variant="secondary">{v.topic}</Badge>,
                                            ],
                                        }))}
                                    empty="Chưa có từ vựng nào."
                                />
                            )}

                            {tab === 'schedules' && (
                                <DataTable
                                    head={['Kỳ thi', 'Đơn vị', 'Tỉnh/Thành', 'Ngày thi', 'Hạn đăng ký', 'Trạng thái']}
                                    rows={(schedules ?? [])
                                        .filter(s => !q
                                            || s.title.toLowerCase().includes(q)
                                            || s.city.toLowerCase().includes(q))
                                        .map(s => ({
                                            key: s.id,
                                            cells: [
                                                <span className="font-medium text-gray-900">{s.title}</span>,
                                                s.organizer,
                                                s.city,
                                                formatDate(s.examDate),
                                                formatDate(s.registrationDeadline),
                                                s.isActive
                                                    ? <Badge className="bg-green-100 text-green-700">Còn hiệu lực</Badge>
                                                    : <Badge variant="secondary">Đã tắt</Badge>,
                                            ],
                                        }))}
                                    empty="Chưa có lịch thi nào."
                                />
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

/** Bảng chung cho cả 4 tab — cùng khung, chỉ khác cột và dữ liệu */
function DataTable({ head, rows, empty }: {
    head: string[]
    rows: { key: string; cells: React.ReactNode[] }[]
    empty: string
}) {
    if (rows.length === 0) {
        return <p className="py-12 text-center text-sm text-gray-500">{empty}</p>
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    {head.map(h => <TableHead key={h}>{h}</TableHead>)}
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map(r => (
                    <TableRow key={r.key}>
                        {r.cells.map((c, i) => (
                            <TableCell key={i} className="text-sm">{c}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
