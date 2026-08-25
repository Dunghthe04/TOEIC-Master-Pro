/**
 * Xem lại chi tiết sau khi nộp bài — bố cục THEO CỤM, giống hệt lúc thi.
 *
 * ─── VÌ SAO VIẾT LẠI ────────────────────────────────────────────────────────────────
 *
 * Bản cũ là một DANH SÁCH PHẲNG: mỗi câu một thẻ, mỗi thẻ tự mang media của nó. Với Part
 * 1, 2, 5 thì đúng — một câu một đề bài. Nhưng Part 3–4 có 3 câu dùng CHUNG một file
 * nghe, và Part 6–7 có 2–5 câu dùng CHUNG một bài đọc. Hậu quả:
 *
 *   - Cụm 41–43 render trình phát audio BA LẦN, cùng một file.
 *   - Cụm 186–190 render ảnh bài đọc NĂM LẦN.
 *   - Lời thoại thì bản cũ chống lặp bằng cách so với DÒNG LIỀN TRƯỚC
 *     (`r.transcript !== prevTranscript`) — một mẹo vá, và nó vỡ ngay khi lọc: lọc "Sai"
 *     mà câu 41 đúng, 42 sai thì 42 thành dòng đầu và lời thoại hiện lại.
 *
 * Gốc rễ: cấu trúc dữ liệu là CỤM, còn giao diện lại phẳng. Mọi mẹo chống lặp chỉ là đắp
 * lên chỗ lệch đó.
 *
 * ─── CÁCH LÀM MỚI ───────────────────────────────────────────────────────────────────
 *
 * Dựng lại đúng các CỤM mà lúc thi đã dùng — gọi thẳng `buildListeningUnits()` và
 * `buildReadingItemsForPart()`, không tự gom lại. Nhờ vậy màn xem lại và màn thi không
 * bao giờ chia cụm khác nhau, và sửa quy tắc gom ở một chỗ là cả hai cùng đổi.
 *
 * Mỗi cụm là MỘT thẻ hai cột:
 *
 *   ┌ Part 3 · Câu 41–43 ──────────────────────── ●●○ 2/3 ┐
 *   │ ĐỀ BÀI (dính khi cuộn)  │ CÂU HỎI                   │
 *   │  audio / ảnh / bài đọc  │  41 ✓  …4 phương án        │
 *   │  lời thoại              │  42 ✗  …                   │
 *   │                         │  43 –  …                   │
 *   └─────────────────────────┴───────────────────────────┘
 *
 * Đề bài nằm MỘT lần cho cả cụm — không phải nhờ mẹo, mà vì nó thuộc về cụm chứ không
 * thuộc về câu. Cột trái `sticky` để cuộn đọc câu 43 vẫn thấy được lời thoại.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import { buildListeningUnits, partToNumber } from '@/lib/examListening'
import {
    buildReadingItemsForPart,
    isPassageGroupCode,
    readingPartsInOrder,
} from '@/lib/examReading'
import ReviewQuestionMap from '@/components/exam/ReviewQuestionMap'
import { getMediaUrl, prefetchMediaToken } from '@/lib/media'
import type { PlayQuestion } from '@/types/test.types'
import type { SessionAnswerReview } from '@/types/test-session.types'

type Filter = 'all' | 'correct' | 'wrong' | 'skipped'

/** Kết quả một câu = đề bài (lúc thi) + chấm điểm (sau khi nộp), ghép lại. */
type Graded = {
    question: PlayQuestion
    review: SessionAnswerReview
    status: 'correct' | 'wrong' | 'skipped'
}

/**
 * Một cụm để xem lại — đúng bằng một MÀN lúc thi.
 *
 * `transcript` và `imageUrls` để ở cấp CỤM chứ không ở cấp câu, vì đó là sự thật của dữ
 * liệu: cả cụm dùng chung. Đặt đúng cấp thì việc chống lặp biến mất — không còn gì để
 * lặp mà phải chống.
 */
type ReviewUnit = {
    key: string
    part: string
    audioUrl: string | null
    imageUrls: string[]
    /**
     * Đoạn văn THẬT của Part 6–7, hoặc null.
     *
     * 🔴 Không phải cứ có `passage` là có đoạn văn. Cột Passage trong Excel thường chỉ
     * chứa MÃ NHÓM ("186-190") để gom câu lại với nhau, còn nội dung nằm ở ảnh. Đổ thẳng
     * ô đó ra màn hình thì người học thấy dòng "186-190" nằm chình ình chỗ bài đọc.
     * Màn thi lọc bằng `isPassageGroupCode`, ở đây phải lọc y hệt.
     */
    passageHtml: string | null
    transcript: string | null
    items: Graded[]
}

type ExamAnswerReviewPanelProps = {
    reviews: SessionAnswerReview[]
    questions: PlayQuestion[]
}

export default function ExamAnswerReviewPanel({
    reviews,
    questions,
}: ExamAnswerReviewPanelProps) {
    const [filter, setFilter] = useState<Filter>('all')

    /**
     * Xin token media trước khi render <audio>/<img>.
     * Component không nhận testId qua props, nhưng URL media đã chứa nó
     * (/api/media/tests/{testId}/...) nên trích ra được — khỏi phải sửa component cha.
     */
    const [mediaReady, setMediaReady] = useState(false)
    useEffect(() => {
        const withMedia = questions.find((q) => q.audioUrl || q.imageUrl)
        const testId = /\/api\/media\/tests\/([0-9a-fA-F-]{36})\//.exec(
            withMedia?.audioUrl ?? withMedia?.imageUrl ?? ''
        )?.[1]
        if (!testId) {
            setMediaReady(true) // đề không có media → render luôn
            return
        }
        prefetchMediaToken(testId).finally(() => setMediaReady(true))
    }, [questions])

    const units = useMemo(
        () => buildReviewUnits(questions, reviews),
        [questions, reviews]
    )

    const all = useMemo(() => units.flatMap((u) => u.items), [units])
    // ── Bản đồ câu ──
    const [mapOpen, setMapOpen] = useState(false)
    const [focusedOrder, setFocusedOrder] = useState<number | null>(null)

    const mapItems = useMemo(
        () =>
            all.map((g) => ({
                order: g.review.orderIndex,
                part: g.question.part,
                status: g.status,
            })),
        [all]
    )

    /**
     * Bấm một ô trên bản đồ → nhảy tới câu đó.
     *
     * 🔴 PHẢI GỠ BỘ LỌC TRƯỚC. Bản đồ luôn hiện đủ 200 câu (đó là điểm của nó), nhưng
     * trang thì chỉ hiện những câu khớp bộ lọc. Đang lọc "Sai" mà bấm vào một câu đúng
     * thì phần tử đó KHÔNG có trong DOM — cuộn tới sẽ không xảy ra gì cả, và người dùng
     * chỉ thấy hộp thoại đóng lại rồi thôi, tưởng nút hỏng.
     */
    const jumpToQuestion = (order: number) => {
        setFilter('all')
        setFocusedOrder(order)
    }

    /**
     * Cuộn SAU KHI React đã vẽ xong.
     *
     * Không cuộn ngay trong onClick được: `setFilter('all')` mới chỉ xếp hàng một lần
     * render, phần tử đích lúc đó chưa tồn tại. Effect chạy sau khi commit nên DOM đã có,
     * còn requestAnimationFrame đợi thêm một khung hình để trình duyệt tính xong layout —
     * thiếu bước này thì cuộn trúng vị trí cũ.
     */
    useEffect(() => {
        if (focusedOrder == null) return

        const raf = requestAnimationFrame(() => {
            document
                .getElementById(`ans-${focusedOrder}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })

        // Xoá viền khoanh sau khi mắt đã bắt được chỗ — để lâu thì nó thành nhiễu, và câu
        // đó trông như đang "được chọn" trong khi chẳng có trạng thái chọn nào ở đây.
        const clear = setTimeout(() => setFocusedOrder(null), 2200)

        return () => {
            cancelAnimationFrame(raf)
            clearTimeout(clear)
        }
    }, [focusedOrder])

    /**
     * Lọc theo CÂU nhưng giữ nguyên CỤM.
     *
     * Bản cũ lọc trên danh sách phẳng nên lọc "Sai" xong là mất sạch ngữ cảnh: còn mỗi
     * câu 42 trơ trọi, không lời thoại, không biết nó thuộc đoạn nghe nào. Ở đây cụm nào
     * còn câu khớp thì giữ cả đề bài của cụm — xem câu sai mà vẫn nghe lại được đoạn băng
     * mới là việc người học cần làm.
     */
    const visible = useMemo(() => {
        if (filter === 'all') return units
        return units
            .map((u) => ({ ...u, items: u.items.filter((g) => g.status === filter) }))
            .filter((u) => u.items.length > 0)
    }, [units, filter])

    // Chặn render tới khi có token media — thiếu ?t= là 401 im lặng, không ảnh/tiếng.
    if (!mediaReady) {
        return <p className="py-12 text-center text-sm text-muted-foreground">Đang tải…</p>
    }

    return (
        <div className="space-y-4 pb-10">
            {/* KHÔNG có thanh điều khiển dính trên đầu trang nữa.
                Nó chiếm nguyên một hàng suốt cả trang chỉ để chứa một nút và bốn con số,
                phần giữa bỏ trống — mà bốn con số đó giờ nằm trong bản đồ câu, còn con số
                đáng nhìn nhất (số câu chưa đúng) thì hiện ngay trên huy hiệu của nút mở.
                Nút "Quay lại chứng chỉ" chuyển xuống thanh chân của ExamShell, nơi mọi nút
                điều hướng khác của màn này vốn đã nằm. */}
            {visible.map((unit) => (
                <UnitCard key={unit.key} unit={unit} focusedOrder={focusedOrder} />
            ))}

            <ReviewQuestionMap
                open={mapOpen}
                onOpenChange={setMapOpen}
                items={mapItems}
                focusedOrder={focusedOrder}
                onJump={jumpToQuestion}
                filter={filter}
                onFilterChange={setFilter}
            />

            {visible.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Không có câu nào trong bộ lọc này.
                </p>
            )}
        </div>
    )
}

// ════════════════════════════════════════════════════════════════════════════
// Dựng cụm
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ghép đề bài (lúc thi) với kết quả chấm (sau khi nộp) rồi chia cụm y như lúc thi.
 *
 * 🔴 DÙNG LẠI đúng hai hàm chia cụm của Exam Engine thay vì tự gom: tự gom là tạo ra một
 * NGUỒN SỰ THẬT THỨ HAI về "câu nào đi với câu nào". Hai nguồn rồi sẽ lệch nhau, và lúc
 * đó màn xem lại hiển thị khác màn thi mà không ai biết vì sao.
 */
function buildReviewUnits(
    questions: PlayQuestion[],
    reviews: SessionAnswerReview[]
): ReviewUnit[] {
    const reviewByQuestion = new Map(reviews.map((r) => [r.questionId, r]))

    /** Câu không có bản chấm thì bỏ — không dựng thẻ rỗng. */
    const grade = (q: PlayQuestion): Graded | null => {
        const review = reviewByQuestion.get(q.questionId)
        if (!review) return null
        return {
            question: q,
            review,
            status: review.isCorrect
                ? 'correct'
                : review.selectedOptionId
                  ? 'wrong'
                  : 'skipped',
        }
    }

    /** Lời thoại của cả cụm — backend trả CÙNG nội dung cho 3 câu, lấy bản đầu có chữ. */
    const transcriptOf = (items: Graded[]) =>
        items.map((g) => g.review.transcript).find((t) => !!t?.trim()) ?? null

    const units: ReviewUnit[] = []

    // ── Listening: 1 câu (P1–2) hoặc 3 câu chung 1 file nghe (P3–4) ──
    for (const u of buildListeningUnits(questions)) {
        const items = u.questions.map(grade).filter((g): g is Graded => g !== null)
        if (items.length === 0) continue

        units.push({
            key: `L:${u.part}:${items[0].question.questionId}`,
            part: u.part,
            audioUrl: u.audioUrl,
            // Part 1: ảnh nằm ở từng câu. Part 3–4: ảnh biểu đồ dùng chung cả cụm.
            imageUrls: dedupe(u.questions.flatMap((q) => splitImages(q.imageUrl))),
            passageHtml: null,
            transcript: transcriptOf(items),
            items,
        })
    }

    // ── Reading: 1 câu (P5) hoặc cụm bài đọc (P6–7) ──
    for (const part of readingPartsInOrder(questions)) {
        for (const item of buildReadingItemsForPart(questions, part)) {
            const groupQs = item.kind === 'single' ? [item.question] : item.questions
            const items = groupQs.map(grade).filter((g): g is Graded => g !== null)
            if (items.length === 0) continue

            units.push({
                key: `R:${part}:${items[0].question.questionId}`,
                part,
                audioUrl: null,
                imageUrls:
                    item.kind === 'passage'
                        ? item.imageUrls
                        : splitImages(item.question.imageUrl),
                passageHtml:
                    item.kind === 'passage' &&
                    item.passage.trim() &&
                    !isPassageGroupCode(item.passage)
                        ? item.passage
                        : null,
                transcript: null,
                items,
            })
        }
    }

    // Câu Listening và Reading đã tách hai vòng lặp nên phải xếp lại theo số câu.
    return units.sort((a, b) => a.items[0].review.orderIndex - b.items[0].review.orderIndex)
}

function splitImages(imageUrl: string | null | undefined): string[] {
    if (!imageUrl?.trim()) return []
    return imageUrl
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function dedupe(list: string[]): string[] {
    return [...new Set(list)]
}

// ════════════════════════════════════════════════════════════════════════════
// Thẻ một cụm
// ════════════════════════════════════════════════════════════════════════════

function UnitCard({
    unit,
    focusedOrder,
}: {
    unit: ReviewUnit
    focusedOrder: number | null
}) {
    const partNum = partToNumber(unit.part)
    const first = unit.items[0].review.orderIndex
    const last = unit.items[unit.items.length - 1].review.orderIndex
    const range = first === last ? `Câu ${first}` : `Câu ${first}–${last}`

    const hasStimulus =
        !!unit.audioUrl ||
        unit.imageUrls.length > 0 ||
        !!unit.passageHtml ||
        !!unit.transcript

    /**
     * Chỉ cụm có ẢNH BÀI ĐỌC (Part 6–7) mới chia cột lệch về bên đề bài.
     *
     * Ảnh bài đọc quét từ giấy, rộng ~1245px, chữ nằm TRONG ảnh — cột càng hẹp thì càng
     * phải thu nhỏ và càng khó đọc. Bên phải chỉ là câu hỏi và 4 phương án, toàn dòng
     * ngắn, thừa chỗ cũng không dùng hết.
     *
     * KHÔNG áp cho ảnh Listening: ảnh Part 1 và biểu đồ Part 3–4 đã bị khống chế chiều
     * cao 360px (xem StimulusPanel), nới cột rộng ra chỉ để thêm khoảng trắng hai bên.
     *
     * Cụm chỉ có audio + lời thoại cũng giữ chia đôi: lời thoại là chữ để đọc, dòng dài
     * quá ~100 ký tự thì mắt bắt đầu nhảy dòng — rộng thêm là hại chứ không lợi.
     */
    const imageHeavy = unit.imageUrls.length > 0 && partNum >= 5

    return (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Thanh cụm — nhận diện cụm và điểm của cụm chỉ bằng một lần liếc */}
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <div className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1a4d7c]">
                        Part {partNum}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-800">
                        {range}
                    </span>
                </div>
                <ScoreDots items={unit.items} />
            </header>

            <div
                className={
                    hasStimulus
                        ? `grid gap-px bg-slate-200 ${imageHeavy
                            ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]'
                            : 'lg:grid-cols-2'
                        }`
                        : ''
                }
            >
                {hasStimulus && (
                    <div className="bg-white p-4">
                        {/* sticky: cụm 5 câu Part 7 dài hơn màn hình, cuộn tới câu cuối mà
                            bài đọc trôi mất thì phải cuộn ngược lên đối chiếu. */}
                        <div className="space-y-3 lg:sticky lg:top-20">
                            <StimulusPanel unit={unit} />
                        </div>
                    </div>
                )}

                <div className="space-y-3 bg-white p-4">
                    {unit.items.map((g) => (
                        <QuestionResult
                            key={g.question.questionId}
                            graded={g}
                            isFocused={g.review.orderIndex === focusedOrder}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}

/** Ba chấm màu + tỉ số — đọc được kết quả cả cụm mà không cần mở từng câu. */
function ScoreDots({ items }: { items: Graded[] }) {
    const correct = items.filter((g) => g.status === 'correct').length

    return (
        <div className="flex items-center gap-2">
            <div className="flex gap-1">
                {items.map((g) => (
                    <span
                        key={g.question.questionId}
                        title={`Câu ${g.review.orderIndex}`}
                        className={`h-2 w-2 rounded-full ${
                            g.status === 'correct'
                                ? 'bg-emerald-500'
                                : g.status === 'wrong'
                                  ? 'bg-rose-500'
                                  : 'bg-amber-400'
                        }`}
                    />
                ))}
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-500">
                {correct}/{items.length}
            </span>
        </div>
    )
}

/** Cột trái: audio, ảnh, bài đọc, lời thoại — MỘT lần cho cả cụm. */
function StimulusPanel({ unit }: { unit: ReviewUnit }) {
    /**
     * Ảnh Listening và ảnh Reading cần hai cỡ khác hẳn nhau — cùng là "ảnh" nhưng dùng
     * để làm hai việc khác nhau:
     *
     *   Part 1, 3–4  ẢNH ĐỂ NHÌN. Bức ảnh văn phòng, cái biểu đồ — liếc một cái là xong.
     *                Ảnh Part 1 cao 948px, để nguyên là chiếm trọn màn hình cho một câu
     *                đã trả lời rồi. Khống chế chiều cao 360px.
     *
     *   Part 6–7     ẢNH ĐỂ ĐỌC. Là trang giấy quét, chữ nằm TRONG ảnh. Thu nhỏ là chữ
     *                nhỏ theo, thu quá thì không đọc nổi — mà đọc lại chính là việc người
     *                học phải làm ở đây. Cho chiếm hết bề ngang cột.
     */
    const isListening = partToNumber(unit.part) <= 4

    return (
        <>
            {unit.audioUrl && (
                <audio
                    controls
                    preload="none"
                    src={getMediaUrl(unit.audioUrl)}
                    className="w-full"
                />
            )}

            {unit.imageUrls.map((url) => (
                <img
                    key={url}
                    src={getMediaUrl(url)}
                    alt=""
                    className={`mx-auto block w-auto max-w-full rounded border border-slate-300 bg-white ${
                        isListening ? 'max-h-[360px]' : 'max-h-[70vh]'
                    }`}
                />
            ))}

            {unit.passageHtml && (
                <div
                    className="prose prose-sm max-w-none whitespace-pre-wrap rounded border border-slate-200 bg-slate-50/60 p-3 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: unit.passageHtml }}
                />
            )}

            {/* Lời thoại: nền giấy ngà, chữ serif — cố ý KHÔNG giống phần còn lại của giao
                diện. Đây là văn bản để ĐỌC LÂU, không phải nhãn hay chú thích; tách nó ra
                khỏi màu xanh của khung app giúp mắt biết ngay đâu là nội dung bài. */}
            {unit.transcript && (
                <details open className="rounded border border-amber-200/80 bg-amber-50/50">
                    <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                        Lời đoạn băng
                        {/* {unit.items.length > 1 && (
                            <span className="ml-1.5 font-normal normal-case tracking-normal text-amber-700">
                                · dùng chung cho cả cụm
                            </span>
                        )} */}
                    </summary>
                    <div className="space-y-2 px-3 pb-3">
                        {splitTranscriptTurns(unit.transcript).map((turn, i) => (
                            <p
                                key={i}
                                className="flex gap-2 font-serif text-[15px] leading-7 text-amber-950"
                            >
                                {/* GIỮ NGOẶC ĐƠN quanh nhãn. Đã tách cột rồi nhưng vẫn để,
                                    vì lý do cũ chưa mất: chữ W và M trần trông y như một
                                    từ trong câu. Ngoặc là dấu hiệu đọc được ở mọi ngữ cảnh,
                                    kể cả khi người dùng bôi đen copy đoạn này ra chỗ khác. */}
                                {turn.speaker && (
                                    <span className="shrink-0 font-sans text-[13px] font-bold text-amber-700">
                                        ({turn.speaker})
                                    </span>
                                )}
                                <span
                                    className="min-w-0 whitespace-pre-line"
                                    dangerouslySetInnerHTML={{ __html: turn.text }}
                                />
                            </p>
                        ))}
                    </div>
                </details>
            )}
        </>
    )
}

/** Một lượt lời trong đoạn băng. `speaker` = null cho phần chưa có nhãn (thường là độc thoại Part 4). */
type Turn = { speaker: string | null; text: string }

/**
 * Các nhãn người nói mà sách ETS dùng — W = woman, M = man; hậu tố là chất giọng
 * (Am Mỹ, Br Anh, Au Úc, Cn Canada); có số khi một đoạn có hai người cùng giới.
 *
 * 🔴 XẾP DÀI TRƯỚC NGẮN trong nhánh alternation. Regex chọn nhánh khớp ĐẦU TIÊN chứ không
 * chọn nhánh dài nhất, nên để "M" trước "M-Au" thì "(M-Au)" khớp thành "M" và cụm ")" thừa
 * lại nằm trong lời thoại.
 */
const SPEAKER_RE =
    /\((M-Am|M-Br|M-Au|M-Cn|W-Am|W-Br|W-Au|W-Cn|M[1-3]|W[1-3]|M|W)\)/g

/**
 * Cắt đoạn băng thành từng lượt lời, mỗi lượt một dòng.
 *
 * VÌ SAO CẦN: model trả transcript về dưới dạng MỘT khối văn xuôi liền —
 * "(W) Hey, Oliver… (M) Yes… (W) Several people…". Đọc một đoạn hội thoại bốn lượt lời
 * dồn thành một khối thì phải tự dò xem ai đang nói, mà đó chính là thông tin quan trọng
 * nhất của Part 3: câu hỏi hay hỏi "người phụ nữ đề nghị gì".
 *
 * Làm ở FRONT-END chứ không sửa ở tool: đây là biến đổi tất định và thuần trình bày, nên
 * áp được ngay lên đề ĐÃ IMPORT vào DB — không phải trích lại, không phải import lại.
 */
function splitTranscriptTurns(raw: string): Turn[] {
    const turns: Turn[] = []
    let speaker: string | null = null
    let cursor = 0

    for (const m of raw.matchAll(SPEAKER_RE)) {
        const text = raw.slice(cursor, m.index).trim()
        if (text) turns.push({ speaker, text })

        speaker = m[1]
        cursor = m.index + m[0].length
    }

    // Phần đuôi sau nhãn cuối cùng. Không có nhãn nào thì cả đoạn về đây thành một khối —
    // đúng cho độc thoại Part 4, vốn không có nhãn người nói.
    const tail = raw.slice(cursor).trim()
    if (tail) turns.push({ speaker, text: tail })

    return turns
}

// ════════════════════════════════════════════════════════════════════════════
// Một câu
// ════════════════════════════════════════════════════════════════════════════

function QuestionResult({
    graded,
    isFocused,
}: {
    graded: Graded
    isFocused: boolean
}) {
    const { question, review, status } = graded

    // Vạch màu bên trái thay cho việc tô viền cả thẻ: cả cụm 5 câu mà mỗi câu một khung
    // màu thì trang thành cái cầu vồng, không còn gì nổi bật. Vạch mảnh vẫn quét mắt được
    // mà không tranh chỗ với phần đánh dấu phương án bên trong.
    const stripe =
        status === 'correct'
            ? 'border-l-emerald-500'
            : status === 'wrong'
              ? 'border-l-rose-500'
              : 'border-l-amber-400'

    return (
        <article
            // Mốc để bản đồ câu cuộn tới. Dùng SỐ CÂU chứ không dùng questionId: số câu là
            // thứ người dùng nhìn thấy và bấm trên bản đồ, nên hai bên nói cùng một ngôn ngữ
            // và không cần tra bảng trung gian nào.
            id={`ans-${review.orderIndex}`}
            className={`scroll-mt-24 rounded-r-lg border-l-4 bg-white pl-3 transition-shadow ${stripe} ${
                isFocused ? 'shadow-[0_0_0_3px_rgba(26,77,124,0.35)]' : ''
            }`}
        >
            <div className="flex items-start gap-2.5">
                <StatusMark status={status} order={review.orderIndex} />
                {question.content?.trim() && (
                    <div
                        className="prose prose-sm max-w-none pt-0.5 text-[15px] font-medium text-slate-800"
                        dangerouslySetInnerHTML={{ __html: question.content }}
                    />
                )}
            </div>

            <ul className="mt-2 space-y-1">
                {question.options
                    .filter((o) => o.content?.trim())
                    .map((opt) => (
                        <OptionRow
                            key={opt.id}
                            label={opt.label}
                            html={opt.content}
                            isCorrect={opt.id === review.correctOptionId}
                            isPicked={opt.id === review.selectedOptionId}
                        />
                    ))}
            </ul>

            {/* CHỈ nói "chưa chọn", KHÔNG nhắc lại đáp án đúng là chữ nào.
                Ngay phía trên, phương án đúng đã có viền xanh, chấm xanh và nhãn
                "✓ Đáp án đúng" — nói thêm một lần nữa bằng chữ là bắt người đọc xác nhận
                cùng một thông tin hai lần, mà lần thứ hai lại kém rõ hơn lần đầu. */}
            {status === 'skipped' && (
                <p className="mt-1.5 text-xs font-medium text-amber-700">
                    Bạn chưa chọn câu này.
                </p>
            )}

            {review.explanation?.trim() && (
                <div className="mt-2 rounded border-l-2 border-sky-300 bg-sky-50/70 px-3 py-2 text-sm leading-relaxed text-slate-700">
                    <span className="font-semibold text-sky-900">Giải thích: </span>
                    <span dangerouslySetInnerHTML={{ __html: review.explanation }} />
                </div>
            )}
        </article>
    )
}

/** Số câu + dấu đúng/sai gộp làm một khối — số ở đâu thì kết quả ở đó. */
function StatusMark({
    status,
    order,
}: {
    status: Graded['status']
    order: number
}) {
    const tone =
        status === 'correct'
            ? 'bg-emerald-100 text-emerald-800'
            : status === 'wrong'
              ? 'bg-rose-100 text-rose-800'
              : 'bg-amber-100 text-amber-800'

    const Icon = status === 'correct' ? Check : status === 'wrong' ? X : Minus

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-sm font-bold tabular-nums ${tone}`}
        >
            {order}
            <Icon className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
    )
}

/**
 * Một phương án.
 *
 * Ba trạng thái cần phân biệt được NGAY, kể cả khi in đen trắng hoặc người dùng mù màu —
 * nên mỗi trạng thái có cả màu LẪN ký hiệu chữ, không chỉ dựa vào màu:
 *   đúng           → viền xanh + ✓ "Đáp án đúng"
 *   mình chọn, sai → viền đỏ  + ✗ "Bạn chọn"
 *   chọn đúng      → viền xanh + cả hai nhãn
 */
function OptionRow({
    label,
    html,
    isCorrect,
    isPicked,
}: {
    label: string
    html: string
    isCorrect: boolean
    isPicked: boolean
}) {
    const box = isCorrect
        ? 'border-emerald-400 bg-emerald-50/70'
        : isPicked
          ? 'border-rose-300 bg-rose-50/70'
          : 'border-transparent'

    const bullet = isCorrect
        ? 'bg-emerald-600 text-white'
        : isPicked
          ? 'bg-rose-500 text-white'
          : 'bg-slate-100 text-slate-600'

    return (
        <li className={`flex items-start gap-2 rounded border px-2 py-1.5 ${box}`}>
            <span
                className={`mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${bullet}`}
            >
                {label}
            </span>
            <span
                className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: html }}
            />
            {(isCorrect || isPicked) && (
                <span
                    className={`shrink-0 whitespace-nowrap text-[11px] font-semibold ${
                        isCorrect ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                >
                    {isCorrect && isPicked
                        ? '✓ Bạn chọn · đúng'
                        : isCorrect
                          ? '✓ Đáp án đúng'
                          : '✗ Bạn chọn'}
                </span>
            )}
        </li>
    )
}

