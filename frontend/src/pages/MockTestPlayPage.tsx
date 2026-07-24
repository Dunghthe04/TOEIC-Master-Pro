/**
 * MockTestPlayPage — Màn thi Listening (Day 27).
 *
 * Luồng chính (giống phòng thi TOEIC):
 *   loading → directions (Part 1) → answering (câu 1, 2, 3...)
 *          → directions (Part 2) → answering → ... → done
 *
 * Âm thanh tự phát + tự chuyển:
 *   - playUrl()        : phát 1 file, hết thì gọi callback
 *   - useEffect directions : phát intro Part → hết → enterAnswering()
 *   - useEffect answering  : phát audio câu → hết → advanceAfterUnit()
 *   - advanceAfterUnit()   : unit kế / Part kế / done
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import type { PlayPartDirections, PlayQuestion, TestPlay } from '@/types/test.types'
import {
    buildListeningUnits,
    isListeningPart,
    listeningPartsInOrder,
    partToNumber,
    type ListeningUnit,
} from '@/lib/examListening'
import { Button } from '@/components/ui/button'
import { ArrowLeft, SkipForward } from 'lucide-react'
import { toast } from 'sonner'
import { getMediaUrl } from '@/lib/media'
import ExamShell from '@/components/layout/ExamShell'

/** 4 trạng thái màn hình — điều khiển phát audio và UI hiển thị */
type Phase = 'loading' | 'directions' | 'answering' | 'done'

export default function MockTestPlayPage() {
    const { id } = useParams<{ id: string }>()
    const [search] = useSearchParams()
    const navigate = useNavigate()

    const [play, setPlay] = useState<TestPlay | null>(null)
    /** Trạng thái hiện tại: đang tải / giới thiệu Part / làm câu / xong */
    const [phase, setPhase] = useState<Phase>('loading')
    /** Part Listening đang ở vị trí mấy trong danh sách (0 = Part đầu tiên có trong đề) */
    const [partIdx, setPartIdx] = useState(0)
    /** Unit audio đang phát trong Part hiện tại (0 = unit đầu tiên) */
    const [unitIdx, setUnitIdx] = useState(0)
    /** Đáp án user đã chọn: { questionId: optionId } */
    const [answers, setAnswers] = useState<Record<string, string>>({})

    /** Tham chiếu tới thẻ <audio> đang phát — dùng để pause/stop khi đổi phase */
    const audioRef = useRef<HTMLAudioElement | null>(null)

    const answersStorageKey = id ? `mock-test-${id}-answers` : null

    // Parse ?parts=1,2,3 → number[]; không có = full
    const partsFilter = useMemo(() => {
        const raw = search.get('parts')
        if (!raw) return undefined
        return raw
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => n >= 1 && n <= 7)
    }, [search])

    /** Load gói play (cần JWT). */
    useEffect(() => {
        if (!id) return
        let cancelled = false
        ;(async () => {
            setPhase('loading')
            try {
                const data = await TestService.getPlay(id, partsFilter)
                if (cancelled) return
                setPlay(data)
                // Khôi phục đáp án tạm (chưa nộp — Day 28)
                let saved: Record<string, string> = {}
                if (answersStorageKey) {
                    try {
                        const raw = localStorage.getItem(answersStorageKey)
                        if (raw) saved = JSON.parse(raw) as Record<string, string>
                    } catch { /* ignore */ }
                }
                setAnswers(saved)
                setPartIdx(0)
                setUnitIdx(0)

                const order = listeningPartsInOrder(data.questions)
                if (order.length === 0) {
                    // Chỉ Reading / không có Listening trong filter
                    setPhase('done')
                    toast.message('Gói này không có Listening — Reading UI ở Day 28.')
                } else {
                    setPhase('directions')
                }
            } catch (err: unknown) {
                const status = (err as { response?: { status?: number; data?: { error?: string } } })
                    ?.response?.status
                const apiErr = (err as { response?: { data?: { error?: string } } })?.response?.data
                    ?.error
                if (status === 401) {
                    toast.error('Phiên đăng nhập hết hạn — hãy login lại.')
                } else {
                    toast.error(apiErr ?? 'Không tải được bài thi.')
                }
                navigate(id ? `/mock-test/${id}` : '/mock-test')
            }
        })()
        return () => {
            cancelled = true
            stopAudio()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, search])

    /** Danh sách Part Listening có trong đề, theo thứ tự: ["Part1", "Part2", "Part3", "Part4"] */
    const partsOrder = useMemo(
        () => (play ? listeningPartsInOrder(play.questions) : []),
        [play]
    )

    /** Part đang làm — lấy từ partsOrder[partIdx] */
    const currentPart = partsOrder[partIdx] ?? null

    /**
     * Màn Directions: ảnh hướng dẫn + audio intro Part.
     * API trả play.directions; không có thì dùng ảnh mặc định /exam/directions/part{N}.png
     */
    const currentDirections: PlayPartDirections | null = useMemo(() => {
        if (!play || !currentPart) return null
        return (
            play.directions.find((d) => d.part === currentPart) ?? {
                part: currentPart,
                imageUrl: `/exam/directions/part${partToNumber(currentPart)}.png`,
                audioUrl: null,
            }
        )
    }, [play, currentPart])

    /**
     * Playlist audio của Part hiện tại.
     * Part 1–2: 1 câu = 1 unit (1 file mp3).
     * Part 3–4: 3 câu cùng audioUrl = 1 unit (hiện 3 câu, phát 1 file).
     * Xem buildListeningUnits() trong examListening.ts
     */
    const units: ListeningUnit[] = useMemo(() => {
        if (!play || !currentPart) return []
        const qs = play.questions.filter((q) => q.part === currentPart)
        return buildListeningUnits(qs)
    }, [play, currentPart])

    /** Unit đang phát / đang hiển thị câu hỏi */
    const currentUnit = units[unitIdx] ?? null

    const answeredCount = useMemo(() => {
        if (!play) return 0
        return play.questions.filter((q) => answers[q.questionId]).length
    }, [play, answers])

    // ═══════════════════════════════════════════════════════════════════════
    // PHẦN AUDIO — tự phát + tự chuyển (core của màn thi Listening)
    // ═══════════════════════════════════════════════════════════════════════

    /** Dừng audio đang phát — gọi khi đổi phase, unmount, hoặc trước khi phát track mới */
    function stopAudio() {
        const a = audioRef.current
        if (!a) return
        a.pause()
        a.removeAttribute('src')
        a.load()
        audioRef.current = null
    }

    /**
     * Hàm lõi phát audio — mọi chỗ phát đều đi qua đây.
     *
     * @param url     Đường dẫn audio từ API (vd /uploads/tests/.../ETS26-T01-7.mp3)
     * @param onEnded Callback chạy khi file phát HẾT — đây là cơ chế "tự chuyển"
     *
     * Luồng:
     *   1. stopAudio() — dừng track cũ (nếu có)
     *   2. Không có url → gọi onEnded() ngay (nhảy tiếp không chờ)
     *   3. new Audio() + play()
     *   4. Lắng nghe sự kiện 'ended' → gọi onEnded()
     */
    const playUrl = useCallback((url: string | null | undefined, onEnded: () => void) => {
        stopAudio()
        if (!url) {
            onEnded()
            return
        }
        const audio = new Audio(getMediaUrl(url))
        audio.preload = 'auto'
        audioRef.current = audio
        const handleEnded = () => onEnded()
        audio.addEventListener('ended', handleEnded)
        audio.addEventListener('error', () => {
            toast.error(
                `Không tải được audio (${url}). Kiểm tra file trong ZIP audio/ và tên khớp Excel.`
            )
        })
        audio.play().catch(() => {
            // Chrome/Safari chặn autoplay nếu user chưa tương tác trang
            // → selectOption() sẽ thử play() lại khi user chọn đáp án
        })
        audio.addEventListener(
            'emptied',
            () => audio.removeEventListener('ended', handleEnded),
            { once: true }
        )
    }, [])

    /** Chuyển từ Directions sang làm câu — reset về unit đầu tiên của Part */
    const enterAnswering = useCallback(() => {
        stopAudio()
        setUnitIdx(0)
        setPhase('answering')
    }, [])

    /**
     * useEffect #1 — DIRECTIONS: tự phát audio intro Part, hết thì vào làm câu.
     *
     * Chạy khi: phase = 'directions' hoặc đổi Part (currentPart).
     * Hết audio intro → enterAnswering() → trigger useEffect #2 bên dưới.
     *
     * User có thể bấm Next (skipDirections) để bỏ qua intro.
     */
    useEffect(() => {
        if (phase !== 'directions' || !currentDirections) return
        playUrl(currentDirections.audioUrl, () => {
            enterAnswering()
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, currentPart])

    /**
     * Hàm chuyển tiếp sau khi 1 unit audio phát xong.
     *
     * Case 1: Còn unit trong Part → unitIdx + 1 (phát audio câu tiếp)
     * Case 2: Hết unit, còn Part → phase = 'directions', partIdx + 1 (sang Part mới)
     * Case 3: Hết Part cuối → phase = 'done'
     */
    const advanceAfterUnit = useCallback(() => {
        setUnitIdx((i) => {
            const next = i + 1
            if (next < units.length) return next

            // Hết units Part này → sang Part Listening tiếp theo hoặc kết thúc
            setPartIdx((p) => {
                const nextPart = p + 1
                if (nextPart < partsOrder.length) {
                    setPhase('directions') // quay lại màn Directions Part mới
                    setUnitIdx(0)
                    return nextPart
                }
                setPhase('done') // hết Part 4 (hoặc Part cuối trong filter)
                return p
            })
            return i
        })
    }, [units.length, partsOrder.length])

    /**
     * useEffect #2 — ANSWERING: tự phát audio câu hiện tại, hết thì chuyển unit/Part.
     *
     * Chạy khi: phase = 'answering' và đổi unitIdx / partIdx / audioUrl.
     * Hết audio câu → advanceAfterUnit() → unit kế hoặc Part kế.
     */
    useEffect(() => {
        if (phase !== 'answering' || !currentUnit) return
        playUrl(currentUnit.audioUrl, () => {
            advanceAfterUnit()
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, partIdx, unitIdx, currentUnit?.audioUrl])

    /** Nút Next trên màn Directions — bỏ qua audio intro, vào làm câu ngay */
    const skipDirections = () => {
        stopAudio()
        enterAnswering()
    }

    const selectOption = (questionId: string, optionId: string) => {
        // User chọn đáp án = tương tác → browser cho phép autoplay, thử play() lại
        const a = audioRef.current
        if (a?.src && a.paused) a.play().catch(() => {})
        setAnswers((prev) => {
            const next = { ...prev, [questionId]: optionId }
            if (answersStorageKey) {
                try {
                    localStorage.setItem(answersStorageKey, JSON.stringify(next))
                } catch { /* ignore */ }
            }
            return next
        })
    }

    /** Khóa scroll body khi đang trong màn thi full screen */
    useEffect(() => {
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [])

    const totalQuestions = play?.questions.length ?? 0

    if (phase === 'loading' || !play) {
        return (
            <ExamShell
                title="…"
                partLabel="Đang tải"
                answeredCount={0}
                totalCount={0}
            >
                <p className="text-sm text-muted-foreground py-12 text-center">
                    Đang tải bài thi…
                </p>
            </ExamShell>
        )
    }

    // ── UI: màn Directions — ảnh hướng dẫn + audio intro tự phát (useEffect #1) ──
    if (phase === 'directions' && currentDirections) {
        return (
            <ExamShell
                title={play.title}
                partLabel={`Part ${partToNumber(currentDirections.part)} — Directions`}
                answeredCount={answeredCount}
                totalCount={totalQuestions}
                footer={
                    <Button onClick={skipDirections}>
                        Next
                        <SkipForward className="w-4 h-4 ml-2" />
                    </Button>
                }
            >
                <div className="rounded-lg border-2 border-[#1a4d7c]/30 bg-white overflow-hidden shadow-sm">
                    <img
                        src={getMediaUrl(currentDirections.imageUrl)}
                        alt={`Directions Part ${partToNumber(currentDirections.part)}`}
                        className="w-full max-h-[calc(100vh-220px)] object-contain mx-auto"
                    />
                </div>
            </ExamShell>
        )
    }

    // ── UI: màn làm câu — audio câu tự phát (useEffect #2), hết thì tự chuyển ──
    if (phase === 'answering' && currentUnit) {
        return (
            <ExamShell
                title={play.title}
                partLabel={`Part ${partToNumber(currentUnit.part)}`}
                answeredCount={answeredCount}
                totalCount={totalQuestions}
            >
                {!currentUnit.audioUrl && (
                    <p className="text-sm text-destructive bg-red-50 border rounded-lg px-4 py-2 mb-4">
                        ⚠ Câu này thiếu audio — kiểm tra import ZIP và cột AudioFile trong Excel.
                    </p>
                )}
                <div className="space-y-4 h-full">
                    {currentUnit.questions.map((q) => (
                        <QuestionBlock
                            key={q.questionId}
                            question={q}
                            selectedId={answers[q.questionId]}
                            onSelect={selectOption}
                            maskOptionText={partToNumber(q.part) <= 2}
                            examMode
                        />
                    ))}
                </div>
            </ExamShell>
        )
    }

    // ── Hết Listening ───────────────────────────────────────
    const listeningQuestions = play.questions.filter((q) => isListeningPart(q.part))

    return (
        <ExamShell
            title={play.title}
            partLabel="Kết thúc Listening"
            answeredCount={answeredCount}
            totalCount={listeningQuestions.length}
            footer={
                <div className="flex gap-2 w-full justify-between">
                    <Button variant="outline" onClick={() => navigate(`/mock-test/${id}`)}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Về cấu trúc đề
                    </Button>
                    <Button onClick={() => navigate('/mock-test')}>Danh sách đề</Button>
                </div>
            }
        >
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    Đã chọn {answeredCount}/{listeningQuestions.length} câu Listening.
                    Reading + nộp session = Day 28.
                </p>

                {listeningQuestions.some((q) => partToNumber(q.part) === 1) && (
                    <section className="space-y-4">
                        <h2 className="font-semibold">Xem lại Part 1 — nội dung đáp án</h2>
                        {listeningQuestions
                            .filter((q) => partToNumber(q.part) === 1)
                            .map((q) => (
                                <QuestionBlock
                                    key={q.questionId}
                                    question={q}
                                    selectedId={answers[q.questionId]}
                                    onSelect={() => {}}
                                    maskOptionText={false}
                                    readOnly
                                />
                            ))}
                    </section>
                )}
            </div>
        </ExamShell>
    )
}

/** Một câu: Part 1 = ảnh trái + radio phải; các Part khác giữ layout cũ. */
function QuestionBlock({
    question,
    selectedId,
    onSelect,
    maskOptionText = false,
    readOnly = false,
    examMode = false,
}: {
    question: PlayQuestion
    selectedId?: string
    onSelect: (questionId: string, optionId: string) => void
    /** Part 1–2 đang thi — ẩn nội dung đáp án, chỉ A/B/C(/D) */
    maskOptionText?: boolean
    readOnly?: boolean
    /** Chiếm gần hết chiều cao màn thi */
    examMode?: boolean
}) {
    const partNum = partToNumber(question.part)
    const options = question.options.filter((o) => o.content?.trim())
    const visibleOptions = partNum === 2 ? options.filter((o) => 'ABC'.includes(o.label)) : options
    const hideText = maskOptionText && partNum <= 2

    // Part 1 — layout giống phòng thi: ảnh to bên trái, radio bên phải
    if (partNum === 1) {
        return (
            <div className="rounded-lg border-2 border-[#1a4d7c]/25 bg-white shadow-sm overflow-hidden">
                <div
                    className={`grid md:grid-cols-2 ${
                        examMode ? 'min-h-[calc(100vh-200px)]' : 'md:min-h-[360px]'
                    }`}
                >
                    {/* Ảnh */}
                    <div className="border-b md:border-b-0 md:border-r border-[#1a4d7c]/20 p-4 flex flex-col bg-white">
                        <p className="text-sm font-semibold text-foreground mb-3">Câu hỏi</p>
                        {question.imageUrl ? (
                            <img
                                src={getMediaUrl(question.imageUrl)}
                                alt=""
                                className={`w-full flex-1 object-contain rounded bg-white ${
                                    examMode ? 'min-h-[280px]' : 'min-h-[240px] max-h-[520px]'
                                }`}
                            />
                        ) : (
                            <div className="flex-1 min-h-[240px] rounded border border-dashed flex items-center justify-center text-muted-foreground text-sm">
                                Không có ảnh
                            </div>
                        )}
                    </div>

                    {/* Đáp án */}
                    <div className="p-6 md:p-8 flex flex-col">
                        <p className="text-xl font-semibold mb-8">{question.orderIndex}.</p>
                        <div
                            className="space-y-5"
                            role="radiogroup"
                            aria-label={`Câu ${question.orderIndex}`}
                        >
                            {visibleOptions.map((opt) => {
                                const selected = selectedId === opt.id
                                const inputId = `${question.questionId}-${opt.id}`
                                return (
                                    <label
                                        key={opt.id}
                                        htmlFor={inputId}
                                        className={`flex items-start gap-3 rounded-md px-2 py-1 -mx-2 transition-colors ${
                                            readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-muted/40'
                                        } ${selected ? 'bg-blue-50' : ''}`}
                                    >
                                        <input
                                            id={inputId}
                                            type="radio"
                                            name={question.questionId}
                                            value={opt.id}
                                            checked={selected}
                                            disabled={readOnly}
                                            onChange={() => onSelect(question.questionId, opt.id)}
                                            className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                                        />
                                        <span className="text-lg leading-snug">
                                            <span className="font-semibold">{opt.label}.</span>
                                            {!hideText && (
                                                <span
                                                    className="ml-2 font-normal text-base"
                                                    dangerouslySetInnerHTML={{ __html: opt.content }}
                                                />
                                            )}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Part 2 — chỉ radio A / B / C (không hiện câu hỏi hay transcript)
    if (partNum === 2 && hideText) {
        return (
            <div
                className={`rounded-lg border-2 border-[#1a4d7c]/25 bg-white shadow-sm flex flex-col items-center justify-center ${
                    examMode ? 'min-h-[calc(100vh-220px)]' : 'min-h-[280px]'
                } p-8 md:p-12`}
            >
                <p className="text-2xl font-semibold mb-10">{question.orderIndex}.</p>
                <div
                    className="flex flex-col sm:flex-row gap-8 sm:gap-16"
                    role="radiogroup"
                    aria-label={`Câu ${question.orderIndex}`}
                >
                    {visibleOptions.map((opt) => {
                        const selected = selectedId === opt.id
                        const inputId = `${question.questionId}-${opt.id}`
                        return (
                            <label
                                key={opt.id}
                                htmlFor={inputId}
                                className={`flex items-center gap-3 cursor-pointer rounded-lg px-4 py-3 transition-colors ${
                                    selected ? 'bg-blue-50 ring-2 ring-blue-600' : 'hover:bg-muted/40'
                                }`}
                            >
                                <input
                                    id={inputId}
                                    type="radio"
                                    name={question.questionId}
                                    value={opt.id}
                                    checked={selected}
                                    onChange={() => onSelect(question.questionId, opt.id)}
                                    className="h-6 w-6 accent-blue-600"
                                />
                                <span className="text-2xl font-bold">{opt.label}</span>
                            </label>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
                Câu {question.orderIndex}
            </div>
            {question.imageUrl && (
                <img
                    src={getMediaUrl(question.imageUrl)}
                    alt=""
                    className="max-h-64 mx-auto rounded border object-contain"
                />
            )}
            {!hideText && question.content && (
                <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: question.content }}
                />
            )}
            <div className="space-y-2">
                {visibleOptions.map((opt) => {
                    const selected = selectedId === opt.id
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            disabled={readOnly}
                            onClick={() => onSelect(question.questionId, opt.id)}
                            className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                                selected
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'hover:bg-muted/50'
                            } ${readOnly ? 'cursor-default opacity-90' : ''}`}
                        >
                            <strong className="mr-2">{opt.label}.</strong>
                            {!hideText && (
                                <span dangerouslySetInnerHTML={{ __html: opt.content }} />
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}