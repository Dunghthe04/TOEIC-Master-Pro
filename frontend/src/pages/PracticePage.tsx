/**
 * SỔ TAY LỖI SAI — thay cho màn "Luyện nhanh" cũ.
 *
 * ─── VÌ SAO THAY ────────────────────────────────────────────────────────────────────
 *
 * Màn cũ có ĐÚNG 0 phiên sau nhiều tháng (`PracticeSessions` rỗng trơn). Lý do không
 * phải giao diện xấu: nó bắt người dùng trả lời ba câu hỏi họ không biết trả lời thế
 * nào — Part nào? Độ khó nào? Mấy câu? — trước khi cho được giá trị gì.
 *
 * Người học không nghĩ "hôm nay tôi muốn 10 câu Part 1 độ khó trung bình". Họ nghĩ
 * "tôi yếu chỗ nào?". Mà hệ thống đã biết câu trả lời từ lâu: 2.300 câu trả lời nằm
 * trong `TestSessionAnswers`, chưa dùng vào việc gì.
 *
 * "Luyện nhanh" là một HÀNH ĐỘNG — phải tự chọn rồi mới có gì làm.
 * "Sổ tay lỗi sai" là một NƠI CHỐN — mở ra là đã có sẵn nội dung của chính mình.
 *
 * ─── XẾP THEO ĐỀ, KHÔNG PHẢI MỘT DANH SÁCH PHẲNG ────────────────────────────────────
 *
 * Bản đầu đổ tất cả câu sai của mọi đề vào một danh sách phẳng, xếp theo "sai nhiều lần
 * lên trước". Người dùng báo lại: "tìm khá lâu". Đúng — các bài đọc Part 7 chiếm gần
 * trọn màn hình và nhìn na ná nhau, nên danh sách phẳng không có mốc nào để định vị:
 * cuộn ba vòng vẫn không biết mình đang ở đề nào, câu số mấy.
 *
 * Giờ sổ tay được chép theo đúng cách người ta chép tay: theo từng đề, trong mỗi đề xếp
 * theo số câu tăng dần, tên đề dính trên đỉnh màn hình khi cuộn. Thêm hai thanh lọc
 * (đề / Part) để nhảy thẳng, khỏi cuộn.
 *
 * ─── VÀ THEO CỤM, KHÔNG LẶP ĐỀ BÀI ──────────────────────────────────────────────────
 *
 * Trong một đề, câu Part 6–7 lại dùng chung bài đọc. Vẽ mỗi câu một thẻ thì cụm 131–134
 * hiện CÙNG một ảnh bốn lần. Nên câu được gom thành cụm (`buildClusters`) và mỗi cụm vẽ
 * hai cột: đề bài một lần bên trái, các câu bên phải. Xem `ReviewClusterCard`.
 *
 * ─── GIỮ NGUYÊN ĐƯỜNG DẪN /practice ─────────────────────────────────────────────────
 *
 * Không đổi sang /review dù tên đã khác: khối HÔM NAY trên Dashboard và deep-link
 * `?part=N` đều đang trỏ vào đây. Đổi đường dẫn là vỡ chúng, để đổi được gì đó chỉ hiện
 * trên thanh địa chỉ.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardList, PartyPopper } from 'lucide-react'
import { toast } from 'sonner'
import ReviewClusterCard from '@/components/review/ReviewClusterCard'
import { partToNumber } from '@/lib/examListening'
import { prefetchMediaToken } from '@/lib/media'
import { groupByTest } from '@/lib/reviewNotebook'
import { ReviewService } from '@/services/review.service'
import type { ReviewNotebookResponse, ReviewQuestionItem } from '@/types/review.types'

/** Số câu lấy mỗi lượt. Backend chặn trần 50. */
const PAGE_SIZE = 20

const EMPTY: ReviewNotebookResponse = { total: 0, byPart: [], byTest: [], matched: 0, items: [] }

/** testId nằm sẵn trong URL media: /api/media/tests/{testId}/... */
const MEDIA_TEST_ID = /\/api\/media\/tests\/([0-9a-fA-F-]{36})\//

/**
 * Xin token media TRƯỚC khi render — nếu không, ảnh Part 6-7 và audio Part 1-4 nhận 401
 * rồi im lặng không hiện.
 *
 * 🔴 KHÁC mọi màn khác ở một điểm: token được ký theo TỪNG ĐỀ, mà sổ tay gom câu sai từ
 * NHIỀU đề. Màn thi chỉ cần prefetch một testId; ở đây phải quét hết danh sách và xin
 * token cho mọi đề có mặt. Prefetch một đề thôi là ảnh của các đề còn lại vẫn trắng.
 */
async function prefetchMediaForItems(items: ReviewQuestionItem[]): Promise<void> {
    const testIds = new Set<string>()
    for (const item of items) {
        for (const url of [item.audioUrl, item.imageUrl]) {
            const id = url ? MEDIA_TEST_ID.exec(url)?.[1] : null
            if (id) testIds.add(id)
        }
    }
    await Promise.all([...testIds].map((id) => prefetchMediaToken(id)))
}

/**
 * Nhãn số câu trên đầu mỗi đề.
 *
 * 🔴 Phải nói rõ "đang hiện 20 / 27", không được ghi trơ mỗi "20 câu": chip trên thanh
 * lọc ghi 27 (tổng thật của đề) còn tiêu đề ghi 20 (số đã tải) thì hai con số đá nhau,
 * và người đọc không biết tin cái nào — cũng không đoán được 7 câu kia đi đâu.
 *
 * 🔴 Nhưng khi ĐANG LỌC PART thì bỏ mẫu số đi. `byTest.count` đếm cả đề, mọi Part; ghi
 * "12 / 27" trong lúc lọc Part 6 là đem số câu Part 6 chia cho tổng cả đề.
 */
function groupCountLabel(shown: number, testTotal: number | undefined, partFiltered: boolean) {
    if (partFiltered || !testTotal || testTotal <= shown) return `${shown} câu`
    return `đang hiện ${shown} / ${testTotal} câu`
}

/** Đọc ?part=N từ URL — khối HÔM NAY deep-link thẳng vào Part yếu nhất. */
function partFromUrl(raw: string | null): number | null {
    const n = Number(raw)
    return n >= 1 && n <= 7 ? n : null
}

export default function PracticePage() {
    const [searchParams] = useSearchParams()
    const [part, setPart] = useState<number | null>(() => partFromUrl(searchParams.get('part')))
    const [testId, setTestId] = useState<string | null>(null)
    const [data, setData] = useState<ReviewNotebookResponse>(EMPTY)
    const [loading, setLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const res = await ReviewService.getQuestions({
                part: part ?? undefined,
                testId: testId ?? undefined,
                take: PAGE_SIZE,
            })
            // Xin token xong mới setData: render trước rồi mới có token thì thẻ <img> đã
            // gọi URL trần, ăn 401, và trình duyệt không tự tải lại.
            await prefetchMediaForItems(res.items)
            setData(res)
        } catch {
            toast.error('Không tải được sổ tay. Thử lại sau.')
            setData(EMPTY)
        } finally {
            setLoading(false)
        }
    }, [part, testId])

    useEffect(() => {
        load()
    }, [load])

    /**
     * Lấy thêm một trang, NỐI vào cuối chứ không thay.
     *
     * Không có nút này thì các câu từ 21 trở đi không có đường nào tới được: lọc theo đề
     * cũng vô ích vì một đề đã 27 câu. Bảo người học "gỡ bớt rồi tải lại" là bắt họ gỡ
     * những câu chưa kịp xem để xem được câu khác.
     */
    const loadMore = async () => {
        setLoadingMore(true)
        try {
            const res = await ReviewService.getQuestions({
                part: part ?? undefined,
                testId: testId ?? undefined,
                skip: data.items.length,
                take: PAGE_SIZE,
            })
            await prefetchMediaForItems(res.items)
            // Giữ items cũ, chỉ nối phần mới. Thay cả mảng thì trang nhảy về đầu và câu
            // đang đọc dở biến mất.
            setData((d) => ({ ...res, items: [...d.items, ...res.items] }))
        } catch {
            toast.error('Không tải thêm được. Thử lại.')
        } finally {
            setLoadingMore(false)
        }
    }

    const groups = useMemo(() => groupByTest(data.items), [data.items])
    const hasFilter = part !== null || testId !== null

    /**
     * Câu vừa được gỡ — bỏ khỏi danh sách TẠI CHỖ, không gọi lại cả trang.
     *
     * Gọi lại thì danh sách nhảy: các câu còn lại đổi vị trí, và câu người dùng đang đọc
     * dở biến mất khỏi tầm mắt. Xoá tại chỗ thì mọi thứ khác đứng yên.
     */
    const handleResolved = (questionId: string, remaining: number) => {
        setData((d) => {
            const gone = d.items.find((i) => i.questionId === questionId)
            // 🔴 byPart.part là SỐ (backend ép (int)), còn item.part là CHUỖI ("Part7").
            // So thẳng hai cái là luôn false — số trên thanh lọc sẽ không bao giờ giảm.
            const gonePart = partToNumber(gone?.part ?? '')

            return {
                total: remaining,
                matched: Math.max(0, d.matched - 1),
                byPart: d.byPart.map((p) =>
                    p.part === gonePart ? { ...p, count: Math.max(0, p.count - 1) } : p
                ),
                byTest: d.byTest.map((t) =>
                    t.testId === gone?.testId ? { ...t, count: Math.max(0, t.count - 1) } : t
                ),
                items: d.items.filter((i) => i.questionId !== questionId),
            }
        })
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#eef2f6] to-white px-4 py-8">
            {/* Rộng 88rem (1408px), không phải 3xl/5xl.
                Cụm Part 6-7 vẽ hai cột, và cột trái phải chứa được ảnh bài đọc ở đúng cỡ
                thật của nó — ảnh rộng nhất trong kho là 1143px, nhân hệ số 0.7 ra 800px.
                Container hẹp hơn thì `max-w-full` lại bóp ảnh xuống, tức là quay về đúng
                cái cỡ chữ nhỏ đang phải soi.
                `w-full` vẫn giữ nên màn hẹp hơn thì tự co, đây chỉ là trần. */}
            <div className="mx-auto w-full max-w-[88rem] space-y-4">
                <header className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-[#1a4d7c]">
                        <ClipboardList className="h-7 w-7" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                            Sổ tay lỗi sai
                        </h1>
                    </div>
                    {/* Bó dòng mô tả lại: trang rộng 1408px mà để câu này trải hết bề
                        ngang thì mắt đọc xong không tìm được đầu dòng sau. */}
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Những câu bạn từng chọn sai, xếp theo đề. Trả lời đúng{' '}
                        <strong>2 lần liên tiếp</strong> thì câu tự rời sổ tay.
                    </p>
                </header>

                {/* ── Thanh lọc ──
                    Số đếm lấy từ `byPart`/`byTest` của TOÀN BỘ sổ tay, không phải của trang
                    hiện tại — nên lọc sang Part 5 rồi vẫn thấy và quay lại được chỗ khác. */}
                {(data.byTest.length > 1 || data.byPart.length > 0) && (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white/70 p-3">
                        {/* Một đề thì không có gì để phân biệt — giấu cả hàng đi cho đỡ rối. */}
                        {data.byTest.length > 1 && (
                            <FilterRow label="Đề">
                                <FilterChip
                                    active={testId === null}
                                    onClick={() => setTestId(null)}
                                    label="Mọi đề"
                                    count={data.total}
                                />
                                {data.byTest.map((t) => (
                                    <FilterChip
                                        key={t.testId}
                                        active={testId === t.testId}
                                        onClick={() => setTestId(t.testId)}
                                        label={t.title}
                                        count={t.count}
                                    />
                                ))}
                            </FilterRow>
                        )}

                        {data.byPart.length > 0 && (
                            <FilterRow label="Part">
                                <FilterChip
                                    active={part === null}
                                    onClick={() => setPart(null)}
                                    label="Mọi Part"
                                    count={data.total}
                                />
                                {data.byPart.map((p) => (
                                    <FilterChip
                                        key={p.part}
                                        active={part === p.part}
                                        onClick={() => setPart(p.part)}
                                        label={`Part ${p.part}`}
                                        count={p.count}
                                    />
                                ))}
                            </FilterRow>
                        )}
                    </div>
                )}

                {loading ? (
                    <p className="py-16 text-center text-sm text-muted-foreground">Đang tải…</p>
                ) : data.items.length === 0 ? (
                    <EmptyState
                        hasFilter={hasFilter}
                        onClear={() => {
                            setPart(null)
                            setTestId(null)
                        }}
                    />
                ) : (
                    <div className="space-y-5">
                        {groups.map((g) => (
                            <section key={g.testId ?? 'unknown'} className="space-y-3">
                                {/* Tên đề DÍNH trên đỉnh khi cuộn (thanh điều hướng cao h-16).
                                    Một ảnh Part 7 chiếm gần trọn màn hình, nên nếu tên đề cuộn
                                    mất thì giữa chừng lại không biết mình đang ở đề nào — đúng
                                    cái làm người dùng "tìm khá lâu". */}
                                <h2 className="sticky top-16 z-20 -mx-1 flex items-center justify-between gap-2 rounded-lg bg-[#eef2f6]/95 px-3 py-2 text-sm font-bold text-[#1a4d7c] backdrop-blur">
                                    <span className="truncate">{g.title}</span>
                                    <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
                                        {groupCountLabel(
                                            g.clusters.reduce((n, c) => n + c.items.length, 0),
                                            data.byTest.find((t) => t.testId === g.testId)?.count,
                                            part !== null
                                        )}
                                    </span>
                                </h2>

                                {g.clusters.map((c) => (
                                    <ReviewClusterCard
                                        key={c.key}
                                        cluster={c}
                                        onResolved={handleResolved}
                                    />
                                ))}
                            </section>
                        ))}

                        {/* Backend trả tối đa PAGE_SIZE câu một lượt. Nói rõ còn bao nhiêu
                            thay vì im lặng cắt — im lặng thì người dùng tưởng đã hết.
                            Dùng `matched` chứ không phải `total`: đang lọc Part 7 mà so với
                            tổng 28 câu thì con số hiện ra là sai. */}
                        {data.matched > data.items.length && (
                            <div className="flex flex-col items-center gap-2 py-4">
                                <p className="text-sm text-muted-foreground">
                                    Đang hiện {data.items.length} trong {data.matched} câu.
                                </p>
                                <button
                                    type="button"
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="rounded-full border border-[#1a4d7c] px-4 py-1.5 text-sm font-semibold text-[#1a4d7c] transition-colors hover:bg-[#1a4d7c] hover:text-white disabled:opacity-50"
                                >
                                    {loadingMore ? 'Đang tải…' : 'Xem thêm'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/**
 * Màn rỗng.
 *
 * Hai trường hợp rất khác nhau, và gộp lại là sai: "sổ tay sạch" là THÀNH TÍCH đáng
 * mừng, còn "lọc chỗ này không có câu nào" chỉ là một bộ lọc chọn hụt.
 */
function EmptyState({ hasFilter, onClear }: { hasFilter: boolean; onClear: () => void }) {
    if (hasFilter) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
                <p className="text-sm text-muted-foreground">
                    Không còn câu nào chưa gỡ khớp bộ lọc này.
                </p>
                <button
                    type="button"
                    onClick={onClear}
                    className="mt-2 text-sm font-medium text-[#1a4d7c] underline underline-offset-2"
                >
                    Xem tất cả
                </button>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 py-14 text-center">
            <PartyPopper className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <p className="font-semibold text-emerald-900">Sổ tay đang sạch</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-emerald-800/80">
                Chưa có câu nào chờ luyện lại. Thi thêm một đề để tìm ra điểm yếu tiếp theo.
            </p>
        </div>
    )
}

/**
 * Một hàng lọc, có nhãn ở đầu.
 *
 * Có nhãn vì giờ có HAI hàng chip trông giống hệt nhau, mỗi hàng đều mở đầu bằng một
 * chip "mọi …". Không nói rõ hàng nào lọc gì thì hai hàng chip cạnh nhau còn khó đọc
 * hơn là không có bộ lọc.
 */
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-9 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
            </span>
            {children}
        </div>
    )
}

function FilterChip({
    active,
    onClick,
    label,
    count,
}: {
    active: boolean
    onClick: () => void
    label: string
    count: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                active
                    ? 'border-[#1a4d7c] bg-[#1a4d7c] text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
        >
            <span className="truncate">{label}</span>
            <span className={`tabular-nums ${active ? 'text-white/80' : 'text-slate-400'}`}>
                {count}
            </span>
        </button>
    )
}
