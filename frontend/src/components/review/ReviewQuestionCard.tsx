/**
 * Một câu trong SỔ TAY LỖI SAI.
 *
 * ─── KHÁC MÀN THI Ở ĐÂU ─────────────────────────────────────────────────────────────
 *
 * Lúc thi: chọn xong không biết đúng sai, phải nộp cả bài mới thấy.
 * Ở đây:   chọn xong biết NGAY, kèm lời giải và lời thoại.
 *
 * Vì mục đích khác nhau. Thi là để ĐO, sổ tay là để HIỂU — mà hiểu thì phản hồi càng
 * sớm càng tốt, đó là toàn bộ lý do tồn tại của màn này.
 */
import { useState } from 'react'
import { Check, Eye, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getMediaUrl } from '@/lib/media'
import { partToNumber } from '@/lib/examListening'
import { parseQuestionImageUrls } from '@/lib/examReading'
import { ReviewService } from '@/services/review.service'
import type { ReviewQuestionItem } from '@/types/review.types'
import { toast } from 'sonner'

/** Ngưỡng gỡ câu — phải khớp `UserQuestionReview.ResolveStreak` ở backend. */
const RESOLVE_STREAK = 2

type Props = {
    item: ReviewQuestionItem
    /** Gọi khi câu rời sổ tay, kèm số câu còn lại để cha cập nhật đếm tại chỗ. */
    onResolved: (questionId: string, remaining: number) => void
    /**
     * Có tự vẽ audio/ảnh của câu này không.
     *
     * false khi thẻ nằm trong một CỤM (Part 3–4 chung file nghe, Part 6–7 chung bài đọc):
     * lúc đó đề bài thuộc về cụm, do <ReviewClusterCard> vẽ MỘT lần ở cột trái. Thẻ vẫn
     * tự vẽ khi đứng một mình (Part 1, 2, 5) vì khi đó đề bài đúng là của riêng câu.
     */
    showMedia?: boolean
}

export default function ReviewQuestionCard({ item, onResolved, showMedia = true }: Props) {
    // Backend trả enum QuestionPart dạng CHUỖI ("Part7"), không phải số.
    const partNum = partToNumber(item.part)

    /**
     * MỌI ảnh của cụm, không chỉ ảnh đầu.
     *
     * 🔴 Một cụm Part 6-7 có thể có 2-3 văn bản (e-mail + thông báo + biểu mẫu), và ô
     * ImageFile chứa cả ba, nối bằng dấu ";". Chỉ hiện ảnh đầu là người học đọc thiếu
     * văn bản rồi không trả lời nổi câu hỏi, mà không hiểu vì sao.
     */
    const images = parseQuestionImageUrls(item.imageUrl)

    // Ảnh Part 1 và biểu đồ Part 3-4 là ảnh ĐỂ NHÌN: liếc một cái là xong, khống chế
    // chiều cao cho gọn. Ảnh bài đọc Part 6-7 là ảnh ĐỂ ĐỌC: chữ nằm trong ảnh, thu nhỏ
    // là không đọc nổi, mà đọc chính là việc phải làm ở màn này.
    const isReadingPassage = partNum >= 6

    const [picked, setPicked] = useState<string | null>(null)
    const [result, setResult] = useState<{ correct: boolean; streak: number } | null>(null)
    const [sending, setSending] = useState(false)

    // Lời giải và lời thoại MỞ SẴN sau khi trả lời, không bắt bấm thêm một nút nữa.
    // Người học vừa sai xong thì thứ họ cần là lý do, không phải một cái nút.
    const answered = result !== null

    const pick = async (optionId: string) => {
        if (answered || sending) return

        setPicked(optionId)
        setSending(true)
        try {
            const res = await ReviewService.answer(item.questionId, optionId)
            setResult({ correct: res.isCorrect, streak: res.correctStreak })

            if (res.resolved) {
                toast.success('Đã gỡ câu này khỏi sổ tay.')
                // Chờ một nhịp cho người dùng kịp thấy đáp án trước khi thẻ biến mất.
                setTimeout(() => onResolved(item.questionId, res.remainingTotal), 1200)
            }
        } catch {
            setPicked(null)
            toast.error('Không ghi được câu trả lời. Thử lại.')
        } finally {
            setSending(false)
        }
    }

    const markUnderstood = async () => {
        setSending(true)
        try {
            const remaining = await ReviewService.resolve(item.questionId)
            onResolved(item.questionId, remaining)
        } catch {
            toast.error('Không gỡ được câu này. Thử lại.')
        } finally {
            setSending(false)
        }
    }

    return (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {/* ── Đầu thẻ: số câu, Part, số lần sai, tiến độ gỡ ── */}
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                    {/* SỐ CÂU đứng trước và nổi nhất.
                        Đây là thứ duy nhất người học nhớ được về một câu — họ không nhớ nội
                        dung (mấy bài đọc Part 7 nhìn na ná nhau) nhưng nhớ "câu 147 phân vân
                        mãi", và nhờ số câu mà dò được sang đề giấy. */}
                    {item.questionNumber !== null && (
                        <span className="rounded bg-[#1a4d7c] px-2 py-0.5 font-bold tabular-nums text-white">
                            Câu {item.questionNumber}
                        </span>
                    )}
                    <span className="rounded bg-[#1a4d7c]/10 px-2 py-0.5 font-semibold text-[#1a4d7c]">
                        Part {partNum}
                    </span>
                    {/* Số lần sai là thông tin quan trọng: câu sai 3 lần khác hẳn câu vừa
                        sai lần đầu, và người học nên biết mình đang đối mặt với cái nào. */}
                    <span className={item.wrongCount >= 3 ? 'font-medium text-rose-600' : 'text-muted-foreground'}>
                        sai {item.wrongCount} lần
                    </span>
                </div>

                {/* "đúng 1/2" — cho thấy danh sách CÓ THỂ VƠI ĐI. Một danh sách không bao
                    giờ vơi thì không ai theo đuổi. */}
                <span className="text-xs tabular-nums text-muted-foreground">
                    đúng {result?.streak ?? item.correctStreak}/{RESOLVE_STREAK}
                </span>
            </header>

            {showMedia && item.audioUrl && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <Volume2 className="h-4 w-4 shrink-0 text-[#1a4d7c]" />
                    <audio controls preload="none" src={getMediaUrl(item.audioUrl)} className="w-full" />
                </div>
            )}

            {showMedia && images.length > 0 && (
                <div className="mb-3 space-y-2">
                    {images.map((url) => (
                        <img
                            key={url}
                            src={getMediaUrl(url)}
                            alt=""
                            className={
                                'mx-auto block w-auto max-w-full rounded border border-slate-300 ' +
                                (isReadingPassage ? '' : 'max-h-[360px]')
                            }
                        />
                    ))}
                </div>
            )}

            {item.content?.trim() && (
                <div
                    className="prose prose-sm mb-3 max-w-none text-[15px] font-medium text-slate-800"
                    dangerouslySetInnerHTML={{ __html: item.content }}
                />
            )}

            {/* ── Phương án ── */}
            <ul className="space-y-1.5">
                {item.options.map((o) => {
                    const isCorrect = o.id === item.correctOptionId
                    const isPicked = o.id === picked

                    // Trước khi trả lời: không tô gì. Tô sẵn đáp án là biến bài luyện thành
                    // bài đọc — người học lướt qua, gật gù, và không nhớ gì.
                    let box = 'border-slate-200 hover:border-[#1a4d7c] hover:bg-slate-50'
                    if (answered) {
                        if (isCorrect) box = 'border-emerald-400 bg-emerald-50/70'
                        else if (isPicked) box = 'border-rose-300 bg-rose-50/70'
                        else box = 'border-transparent opacity-60'
                    }

                    return (
                        <li key={o.id}>
                            <button
                                type="button"
                                disabled={answered || sending}
                                onClick={() => pick(o.id)}
                                className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${box}`}
                            >
                                <span className="mt-px inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                                    {o.label}
                                </span>
                                <span
                                    className="min-w-0 flex-1 text-sm leading-relaxed text-slate-700"
                                    dangerouslySetInnerHTML={{ __html: o.content }}
                                />
                                {answered && isCorrect && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                                {answered && isPicked && !isCorrect && <X className="h-4 w-4 shrink-0 text-rose-500" />}
                            </button>
                        </li>
                    )
                })}
            </ul>

            {/* ── Sau khi trả lời: lý do, mở sẵn ── */}
            {answered && (
                <div className="mt-3 space-y-2">
                    {item.explanation && (
                        <div
                            className="rounded border-l-2 border-sky-300 bg-sky-50/70 px-3 py-2 text-sm leading-relaxed text-slate-700"
                            dangerouslySetInnerHTML={{ __html: item.explanation }}
                        />
                    )}

                    {item.transcript && (
                        <details className="rounded border border-amber-200/80 bg-amber-50/50">
                            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-wider text-amber-900">
                                Lời đoạn băng
                            </summary>
                            <div className="whitespace-pre-line px-3 pb-3 font-serif text-[15px] leading-7 text-amber-950">
                                {item.transcript}
                            </div>
                        </details>
                    )}

                    {!item.explanation && !item.transcript && (
                        <p className="text-xs text-muted-foreground">
                            Câu này chưa có lời giải trong kho.
                        </p>
                    )}
                </div>
            )}

            {/* ── Nút tự gỡ ──
                Người học biết rõ hơn máy: có câu chỉ sai vì bấm nhầm, bắt luyện thêm hai
                lần nữa là phí thời gian — và họ sẽ bỏ qua cả sổ tay chứ không chỉ câu đó. */}
            <footer className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" disabled={sending} onClick={markUnderstood}>
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    Đã hiểu, gỡ khỏi sổ tay
                </Button>
            </footer>
        </article>
    )
}
