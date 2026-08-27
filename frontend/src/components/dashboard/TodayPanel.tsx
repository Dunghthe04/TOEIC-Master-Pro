/**
 * Khối "HÔM NAY" — dòng đầu tiên người học nhìn thấy khi mở Dashboard.
 *
 * ─── VÌ SAO CÓ KHỐI NÀY ─────────────────────────────────────────────────────────────
 *
 * Phần còn lại của Dashboard (5 thẻ tổng quan, biểu đồ điểm, phân tích Part) trả lời câu
 * hỏi NHÌN LẠI: "tôi đã đi được đến đâu". Đúng và cần — nên giữ nguyên, không đụng.
 *
 * Nhưng câu hỏi NHÌN TỚI thì trước đây không ai trả lời: người học xem biểu đồ thấy
 * 545/750, rồi đóng tab — vì không có bước kế tiếp nào được chỉ ra.
 *
 * Khối này chỉ làm đúng một việc: **nói thẳng hôm nay nên làm gì**, mỗi dòng một hành
 * động, có sẵn thời lượng ước tính, bấm là đi thẳng tới nơi.
 *
 * ─── NGUYÊN TẮC: KHÔNG BAO GIỜ ĐỂ TRỐNG ─────────────────────────────────────────────
 *
 * Người mới tinh (0 phiên thi, 0 câu sai, 0 thẻ từ) vẫn phải nhận được MỘT việc. Backend
 * đảm bảo điều đó bằng `suggestedTestId` — "thi một đề đi" là hành động khởi đầu hợp lý
 * duy nhất. Component này không có nhánh nào render ra khối rỗng.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, BookOpen, ClipboardList, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TodayPlanResponse } from '@/types/test-session.types'

/** Một việc để làm. `to` là đích khi bấm. */
type Task = {
    key: string
    icon: typeof BookOpen
    label: string
    /** Thời lượng ước tính — để người học biết mình đang cam kết bao lâu trước khi bấm. */
    minutes: number | null
    cta: string
    to: string
    tone: 'wrong' | 'vocab' | 'test'
}

/**
 * Ước lượng thời gian.
 *
 * Con số này quan trọng hơn vẻ ngoài của nó: "12 câu" là một lời mời mơ hồ, còn "12 câu ·
 * ~8 phút" là một lời mời có giá rõ ràng. Người bận sẽ bấm cái 4 phút thay vì bỏ đi.
 *
 * ~40 giây/câu (gồm đọc lời giải), ~25 giây/thẻ từ. Ước lượng thô nhưng đúng bậc.
 */
const minutesForQuestions = (n: number) => Math.max(1, Math.round((n * 40) / 60))
const minutesForCards = (n: number) => Math.max(1, Math.round((n * 25) / 60))

const TONE: Record<Task['tone'], string> = {
    wrong: 'text-rose-600 bg-rose-50',
    vocab: 'text-amber-600 bg-amber-50',
    test: 'text-[#1a4d7c] bg-[#1a4d7c]/10',
}

export default function TodayPanel({ plan }: { plan: TodayPlanResponse }) {
    const navigate = useNavigate()

    const tasks = useMemo<Task[]>(() => {
        const list: Task[] = []

        if (plan.wrongTotal > 0) {
            list.push({
                key: 'wrong',
                icon: ClipboardList,
                label: `${plan.wrongTotal} câu bạn từng làm sai`,
                minutes: minutesForQuestions(plan.wrongTotal),
                cta: 'Luyện lại',
                to: '/practice',
                tone: 'wrong',
            })
        }

        if (plan.vocabDue > 0) {
            list.push({
                key: 'vocab',
                icon: BookOpen,
                label: `${plan.vocabDue} thẻ từ đến hạn ôn`,
                minutes: minutesForCards(plan.vocabDue),
                cta: 'Ôn ngay',
                to: '/vocabulary',
                tone: 'vocab',
            })
        }

        // Dòng "thi đề" hiện khi TUẦN NÀY CHƯA THI, hoặc khi chưa có việc nào khác.
        //
        // Vế thứ hai là lưới an toàn cho người mới: chưa thi lần nào thì không có câu sai,
        // không có thẻ từ — mà khối vẫn phải đưa ra được một việc.
        if (plan.suggestedTestId && (!plan.testedThisWeek || list.length === 0)) {
            list.push({
                key: 'test',
                icon: Target,
                label: plan.testedThisWeek
                    ? `Thi thêm một đề: ${plan.suggestedTestTitle}`
                    : `Tuần này chưa thi đề nào`,
                minutes: null,
                cta: plan.suggestedTestTitle ?? 'Thi ngay',
                to: `/mock-test/${plan.suggestedTestId}`,
                tone: 'test',
            })
        }

        return list
    }, [plan])

    // Phần lớn nhất trong số câu sai — dòng gợi ý ở chân khối.
    const weakest = useMemo(
        () => [...plan.wrongByPart].sort((a, b) => b.count - a.count)[0] ?? null,
        [plan.wrongByPart]
    )

    return (
        <section className="rounded-xl border border-[#1a4d7c]/20 bg-white p-4 shadow-sm md:p-5">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div className="inline-flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#1a4d7c]" />
                    <h2 className="text-base font-bold uppercase tracking-wide text-[#1a4d7c]">
                        Hôm nay
                    </h2>
                </div>

                {/* Mục tiêu · điểm hiện tại · còn mấy tuần — bối cảnh cho mọi việc bên dưới */}
                <p className="text-sm text-muted-foreground tabular-nums">
                    Mục tiêu <strong className="text-foreground">{plan.targetScore}</strong>
                    {plan.latestScore != null && (
                        <> · hiện tại <strong className="text-foreground">{plan.latestScore}</strong></>
                    )}
                    {plan.weeksLeft != null && (
                        <> · còn <strong className="text-foreground">{plan.weeksLeft}</strong> tuần</>
                    )}
                </p>
            </header>

            <ul className="space-y-2">
                {tasks.map((t) => (
                    <li
                        key={t.key}
                        className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                    >
                        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${TONE[t.tone]}`}>
                            <t.icon className="h-4 w-4" />
                        </span>

                        <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                            {t.label}
                        </span>

                        {t.minutes != null && (
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                ~{t.minutes} phút
                            </span>
                        )}

                        <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => navigate(t.to)}
                        >
                            {t.cta}
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                    </li>
                ))}
            </ul>

            {/* Điểm yếu rõ nhất — dẫn thẳng vào Part đó.
                `/practice?part=N` là deep-link đã có sẵn từ trước, không phải thêm mới. */}
            {weakest && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Sai nhiều nhất:</span>
                    <strong className="text-slate-800">
                        Part {weakest.part} — {weakest.count} câu
                    </strong>
                    <button
                        type="button"
                        className="font-medium text-[#1a4d7c] underline underline-offset-2 hover:text-[#153d63]"
                        onClick={() => navigate(`/practice?part=${weakest.part}`)}
                    >
                        Luyện riêng Part này
                    </button>
                </p>
            )}

            {/* Câu bỏ trống: chỉ là GHI CHÚ, không phải một việc.
                Backend cố ý tách khỏi wrongTotal — câu chọn sai là lỗi sai, câu bỏ trống là
                khoảng trống. Nhưng giấu hẳn con số đi thì người dùng không hiểu vì sao "sai
                47 câu" trong khi họ nhớ mình bỏ trống cả trăm câu. */}
            {plan.skippedTotal > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                    (Ngoài ra còn {plan.skippedTotal} câu bỏ trống — chưa tính là câu sai.)
                </p>
            )}
        </section>
    )
}
