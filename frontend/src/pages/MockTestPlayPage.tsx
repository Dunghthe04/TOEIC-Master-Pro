/**
 * MockTestPlayPage — Màn thi Listening + Reading (Day 27–28).
 *
 * Listening: directions → answering (audio tự phát, tự chuyển).
 * Reading (Bước 6): directions → làm câu thủ công (Next/Prev), Part 5 / 6–7 passage.
 *
 * Day 28 Bước 5 — TestSession: start(), saveAnswers() (debounce).
 * Bước 7 — Nối Listening → Reading: màn nghỉ giữa section, user bấm tiếp tục.
 * Bước 8 — Nộp bài (submit) + màn kết quả ExamResultScreen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import { TestSessionService } from '@/services/test-session.service'
import type { PlayPartDirections, PlayQuestion, TestPlay } from '@/types/test.types'
import type { TestSessionSubmitResult } from '@/types/test-session.types'
import {
    buildListeningUnits,
    isListeningPart,
    listeningPartsInOrder,
    partToNumber,
    type ListeningUnit,
} from '@/lib/examListening'
import {
    buildReadingItemsForPart,
    isReadingPart,
    isPassageGroupCode,
    readingPartsInOrder,
    type ReadingItem,
} from '@/lib/examReading'
import { Button } from '@/components/ui/button'
import {
    ArrowLeft,
    BookOpen,
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Headphones,
    SkipForward,
} from 'lucide-react'
import { toast } from 'sonner'
import { getMediaUrl } from '@/lib/media'
import {
    formatListeningAudioError,
    type AudioErrorContext,
} from '@/lib/examMediaMessages'
import ExamShell from '@/components/layout/ExamShell'
import ExamResultScreen from '@/components/exam/ExamResultScreen'
import ReadingQuestionPalette from '@/components/exam/ReadingQuestionPalette'

/** Trạng thái màn hình — điều khiển audio (Listening) và UI */
type Phase = 'loading' | 'directions' | 'answering' | 'section-break' | 'done' | 'results'
/** Phần đang thi: Listening trước, Reading sau (Bước 7 nối luồng) */
type ExamSection = 'listening' | 'reading'

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
    /** ID phiên thi trên server — từ POST /test-session/start */
    const [sessionId, setSessionId] = useState<string | null>(null)
    /** Thời điểm bắt đầu phiên — hiển thị trên chứng chỉ */
    const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
    /** Listening hay Reading — đổi sau khi hết Part 4 (hoặc vào thẳng Reading nếu filter chỉ P5–7) */
    const [section, setSection] = useState<ExamSection>('listening')
    /** Màn Reading hiện tại trong Part (0 = câu/passage đầu) */
    const [readingItemIdx, setReadingItemIdx] = useState(0)
    /** Câu đánh dấu xem lại — chỉ UI local, chưa sync server */
    const [bookmarks, setBookmarks] = useState<Record<string, true>>({})
    /** Bảng soát câu Reading */
    const [readingPaletteOpen, setReadingPaletteOpen] = useState(false)
    /** Kết quả sau submit — hiển thị màn ExamResultScreen */
    const [submitResult, setSubmitResult] = useState<TestSessionSubmitResult | null>(null)
    /** Đang gọi API nộp bài */
    const [isSubmitting, setIsSubmitting] = useState(false)

    /** Tham chiếu tới thẻ <audio> đang phát — dùng để pause/stop khi đổi phase */
    const audioRef = useRef<HTMLAudioElement | null>(null)
    /** Debounce gửi đáp án lên server — tránh gọi API mỗi lần click */
    const saveAnswersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    /** Tránh toast lỗi audio trùng lặp cho cùng một file */
    const audioErrorShownRef = useRef<Set<string>>(new Set())
    /** sessionId mới nhất — dùng trong callback tránh stale closure */
    const sessionIdRef = useRef<string | null>(null)
    /** Đáp án mới nhất — flush trước khi submit */
    const answersRef = useRef<Record<string, string>>({})
    sessionIdRef.current = sessionId
    answersRef.current = answers

    // Parse ?parts=1,2,3 → number[]; không có = full
    const partsFilter = useMemo(() => {
        const raw = search.get('parts')
        if (!raw) return undefined
        return raw
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => n >= 1 && n <= 7)
    }, [search])

    /** Load phiên thi + gói câu hỏi (cần JWT). */
    useEffect(() => {
        if (!id) return
        let cancelled = false
        ;(async () => {
            setPhase('loading')
            setSessionId(null)
            setSessionStartedAt(null)
            setSubmitResult(null)
            setIsSubmitting(false)
            try {
                // Bước A: tạo TestSession trên server (thay localStorage Day 27)
                const session = await TestSessionService.start({
                    testId: id,
                    parts: partsFilter,
                })
                if (cancelled) return
                setSessionId(session.sessionId)
                setSessionStartedAt(session.startedAt)

                // Bước B: lấy câu hỏi + directions (che đáp án đúng)
                const data = await TestService.getPlay(id, partsFilter)
                if (cancelled) return
                setPlay(data)
                setAnswers({})
                setBookmarks({})
                setPartIdx(0)
                setUnitIdx(0)
                setReadingItemIdx(0)

                const listenOrder = listeningPartsInOrder(data.questions)
                const readOrder = readingPartsInOrder(data.questions)
                if (listenOrder.length > 0) {
                    setSection('listening')
                    setPhase('directions')
                } else if (readOrder.length > 0) {
                    setSection('reading')
                    setPhase('directions')
                    toast.message('Gói này chỉ có Reading — bắt đầu Part 5–7.')
                } else {
                    setPhase('done')
                    toast.error('Gói này không có câu hỏi.')
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
            if (saveAnswersTimerRef.current) clearTimeout(saveAnswersTimerRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, search])

    /** Đóng bảng soát khi rời màn làm Reading */
    useEffect(() => {
        if (section !== 'reading' || phase !== 'answering') {
            setReadingPaletteOpen(false)
        }
    }, [section, phase])

    /** Part Listening có trong đề */
    const listeningPartsOrder = useMemo(
        () => (play ? listeningPartsInOrder(play.questions) : []),
        [play]
    )

    /** Part Reading có trong đề */
    const readingPartsOrder = useMemo(
        () => (play ? readingPartsInOrder(play.questions) : []),
        [play]
    )

    /** Part đang làm — theo section Listening hoặc Reading */
    const partsOrder = section === 'listening' ? listeningPartsOrder : readingPartsOrder
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

    /** Playlist audio — chỉ Listening */
    const units: ListeningUnit[] = useMemo(() => {
        if (!play || !currentPart || section !== 'listening') return []
        const qs = play.questions.filter((q) => q.part === currentPart)
        return buildListeningUnits(qs)
    }, [play, currentPart, section])

    /** Các màn Reading trong Part hiện tại */
    const readingItems: ReadingItem[] = useMemo(() => {
        if (!play || !currentPart || section !== 'reading') return []
        return buildReadingItemsForPart(play.questions, currentPart)
    }, [play, currentPart, section])

    const currentReadingItem = readingItems[readingItemIdx] ?? null

    /** Unit đang phát / đang hiển thị câu hỏi */
    const currentUnit = units[unitIdx] ?? null

    const answeredCount = useMemo(() => {
        if (!play) return 0
        return play.questions.filter((q) => answers[q.questionId]).length
    }, [play, answers])

    /** Thống kê Listening — dùng màn chuyển section (Bước 7) */
    const listeningStats = useMemo(() => {
        if (!play) return { total: 0, answered: 0 }
        const qs = play.questions.filter((q) => isListeningPart(q.part))
        return {
            total: qs.length,
            answered: qs.filter((q) => answers[q.questionId]).length,
        }
    }, [play, answers])

    /** Thống kê Reading — hiển thị trên màn chuyển section */
    const readingStats = useMemo(() => {
        if (!play) return { total: 0, parts: [] as string[] }
        const qs = play.questions.filter((q) => isReadingPart(q.part))
        return {
            total: qs.length,
            parts: readingPartsInOrder(play.questions),
        }
    }, [play])

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
    const playUrl = useCallback((
        url: string | null | undefined,
        onEnded: () => void,
        errorContext?: Omit<AudioErrorContext, 'url'>
    ) => {
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
            const ctx: AudioErrorContext = {
                kind: errorContext?.kind ?? 'question',
                part: errorContext?.part ?? '',
                orderIndexes: errorContext?.orderIndexes,
                url,
            }
            const dedupeKey = `${ctx.kind}|${url}`
            if (audioErrorShownRef.current.has(dedupeKey)) return
            audioErrorShownRef.current.add(dedupeKey)
            console.warn('[Exam audio] Không tải được:', url, ctx)
            toast.error(formatListeningAudioError(ctx), { duration: 8000 })
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
        if (section !== 'listening' || phase !== 'directions' || !currentDirections) return
        playUrl(currentDirections.audioUrl, () => {
            enterAnswering()
        }, {
            kind: 'directions',
            part: currentPart,
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section, phase, currentPart])

    /**
     * Hàm chuyển tiếp sau khi 1 unit audio phát xong.
     *
     * Case 1: Còn unit trong Part → unitIdx + 1 (phát audio câu tiếp)
     * Case 2: Hết unit, còn Part → phase = 'directions', partIdx + 1 (sang Part mới)
     * Case 3: Hết Part Listening cuối → màn nghỉ section-break (có Reading) hoặc done
     */
    /**
     * Hết Listening — dừng audio, chuyển màn nghỉ giữa section (không nhảy thẳng Reading).
     * User xác nhận → startReadingSection().
     */
    const transitionToReading = useCallback(() => {
        stopAudio()
        if (readingPartsOrder.length > 0) {
            setPhase('section-break')
        } else {
            setPhase('done')
        }
    }, [readingPartsOrder.length])

    /** User bấm "Bắt đầu Reading" sau màn nghỉ giữa section */
    const startReadingSection = useCallback(() => {
        stopAudio()
        setSection('reading')
        setPartIdx(0)
        setReadingItemIdx(0)
        setUnitIdx(0)
        setPhase('directions')
    }, [])

    const advanceAfterUnit = useCallback(() => {
        setUnitIdx((i) => {
            const next = i + 1
            if (next < units.length) return next

            setPartIdx((p) => {
                const nextPart = p + 1
                if (nextPart < listeningPartsOrder.length) {
                    setPhase('directions')
                    setUnitIdx(0)
                    return nextPart
                }
                transitionToReading()
                return p
            })
            return i
        })
    }, [units.length, listeningPartsOrder.length, transitionToReading])

    /**
     * useEffect #2 — ANSWERING: tự phát audio câu hiện tại, hết thì chuyển unit/Part.
     *
     * Chạy khi: phase = 'answering' và đổi unitIdx / partIdx / audioUrl.
     * Hết audio câu → advanceAfterUnit() → unit kế hoặc Part kế.
     */
    useEffect(() => {
        if (section !== 'listening' || phase !== 'answering' || !currentUnit) return
        playUrl(currentUnit.audioUrl, () => {
            advanceAfterUnit()
        }, {
            kind: 'question',
            part: currentUnit.part,
            orderIndexes: currentUnit.questions.map((q) => q.orderIndex),
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section, phase, partIdx, unitIdx, currentUnit?.audioUrl])

    /** Nút Next trên Directions — Listening bỏ intro; Reading vào làm câu */
    const skipDirections = () => {
        stopAudio()
        if (section === 'reading') {
            setReadingItemIdx(0)
            setPhase('answering')
        } else {
            enterAnswering()
        }
    }

    /** Chuyển màn Reading: câu/passage kế hoặc Part kế hoặc done */
    const advanceReading = useCallback(() => {
        if (readingItemIdx + 1 < readingItems.length) {
            setReadingItemIdx((i) => i + 1)
            return
        }
        const nextPart = partIdx + 1
        if (nextPart < readingPartsOrder.length) {
            setPartIdx(nextPart)
            setReadingItemIdx(0)
            setPhase('directions')
            return
        }
        setPhase('done')
    }, [readingItemIdx, readingItems.length, partIdx, readingPartsOrder.length])

    const goBackReading = useCallback(() => {
        if (readingItemIdx > 0) {
            setReadingItemIdx((i) => i - 1)
            return
        }
        if (partIdx > 0) {
            const prevPart = partIdx - 1
            const prevItems = play
                ? buildReadingItemsForPart(play.questions, readingPartsOrder[prevPart])
                : []
            setPartIdx(prevPart)
            setReadingItemIdx(Math.max(0, prevItems.length - 1))
            setPhase('answering')
        }
    }, [readingItemIdx, partIdx, play, readingPartsOrder])

    const toggleBookmark = (questionId: string) => {
        setBookmarks((prev) => {
            const next = { ...prev }
            if (next[questionId]) delete next[questionId]
            else next[questionId] = true
            return next
        })
    }

    const canGoBackReading = readingItemIdx > 0 || partIdx > 0

    /** Nhảy tới màn Reading chứa câu được chọn trên bảng soát */
    const jumpToReading = useCallback((targetPartIdx: number, targetReadingItemIdx: number) => {
        setPartIdx(targetPartIdx)
        setReadingItemIdx(targetReadingItemIdx)
        setPhase('answering')
    }, [])

    /**
     * Gửi toàn bộ đáp án hiện tại lên server (debounce 400ms).
     * Upsert theo questionId — xem TestSessionService.saveAnswers.
     */
    const scheduleSaveAnswers = useCallback((next: Record<string, string>) => {
        const sid = sessionIdRef.current
        if (!sid) return
        if (saveAnswersTimerRef.current) clearTimeout(saveAnswersTimerRef.current)
        saveAnswersTimerRef.current = setTimeout(() => {
            const items = Object.entries(next).map(([questionId, selectedOptionId]) => ({
                questionId,
                selectedOptionId,
            }))
            if (items.length === 0) return
            TestSessionService.saveAnswers(sid, items).catch(() => {
                toast.error('Không lưu được đáp án tạm — kiểm tra mạng.')
            })
        }, 400)
    }, [])

    /** Gửi ngay mọi đáp án đang có — gọi trước submit để không mất câu cuối (debounce) */
    const flushSaveAnswers = useCallback(async () => {
        const sid = sessionIdRef.current
        if (!sid) return
        if (saveAnswersTimerRef.current) {
            clearTimeout(saveAnswersTimerRef.current)
            saveAnswersTimerRef.current = null
        }
        const items = Object.entries(answersRef.current).map(([questionId, selectedOptionId]) => ({
            questionId,
            selectedOptionId,
        }))
        if (items.length === 0) return
        await TestSessionService.saveAnswers(sid, items)
    }, [])

    /** Nộp bài — flush đáp án → POST submit → màn kết quả */
    const handleSubmit = useCallback(async () => {
        const sid = sessionIdRef.current
        if (!sid || isSubmitting) return
        setIsSubmitting(true)
        try {
            await flushSaveAnswers()
            const result = await TestSessionService.submit(sid)
            setSubmitResult(result)
            setPhase('results')
            toast.success('Nộp bài thành công!')
        } catch (err: unknown) {
            const apiErr = (err as { response?: { data?: { error?: string } } })?.response?.data
                ?.error
            toast.error(apiErr ?? 'Không nộp được bài — thử lại.')
        } finally {
            setIsSubmitting(false)
        }
    }, [flushSaveAnswers, isSubmitting])

    const selectOption = (questionId: string, optionId: string) => {
        // User chọn đáp án = tương tác → browser cho phép autoplay, thử play() lại
        const a = audioRef.current
        if (a?.src && a.paused) a.play().catch(() => {})
        setAnswers((prev) => {
            const next = { ...prev, [questionId]: optionId }
            scheduleSaveAnswers(next)
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

    // ── UI: Màn kết quả sau nộp bài (Bước 8) ──
    if (phase === 'results' && submitResult && play && sessionStartedAt) {
        return (
            <ExamResultScreen
                title={play.title}
                testSeries={play.series}
                result={submitResult}
                startedAt={sessionStartedAt}
                questions={play.questions}
                onBackStructure={() => navigate(`/mock-test/${id}`)}
                onBackList={() => navigate('/mock-test')}
            />
        )
    }

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

    // ── UI: Màn nghỉ giữa Listening → Reading (Bước 7) ──
    if (phase === 'section-break') {
        const nextPartNum = readingStats.parts[0]
            ? partToNumber(readingStats.parts[0])
            : 5

        return (
            <ExamShell
                title={play.title}
                partLabel="Kết thúc Listening"
                answeredCount={answeredCount}
                totalCount={totalQuestions}
                footer={
                    <Button onClick={startReadingSection} size="lg">
                        Bắt đầu phần Reading
                        <BookOpen className="w-4 h-4 ml-2" />
                    </Button>
                }
            >
                <div className="max-w-2xl mx-auto space-y-6 py-4">
                    <div className="rounded-xl border-2 border-[#1a4d7c]/25 bg-white shadow-sm overflow-hidden">
                        <div className="bg-[#1a4d7c] text-white px-6 py-4 flex items-center gap-3">
                            <Headphones className="w-6 h-6 shrink-0" />
                            <div>
                                <p className="font-semibold text-lg">Đã hoàn thành Listening</p>
                                <p className="text-sm text-white/85">
                                    Part 1–4 — audio đã phát xong
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-5 space-y-3 text-sm">
                            <p>
                                Bạn đã chọn{' '}
                                <strong>
                                    {listeningStats.answered}/{listeningStats.total}
                                </strong>{' '}
                                câu Listening.
                            </p>
                            <p className="text-muted-foreground">
                                Đáp án đã được lưu tạm trên server. Bạn có thể nghỉ ngắn trước
                                khi sang phần Reading.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-[#1a4d7c]/40 bg-white/80 px-6 py-5 flex items-start gap-4">
                        <BookOpen className="w-8 h-8 text-[#1a4d7c] shrink-0 mt-0.5" />
                        <div className="space-y-2 text-sm">
                            <p className="font-semibold text-base text-[#1a4d7c]">
                                Tiếp theo: Reading
                            </p>
                            <p className="text-muted-foreground">
                                {readingStats.total} câu — Part{' '}
                                {readingStats.parts.map((p) => partToNumber(p)).join(', ')}.
                                Bắt đầu từ Directions Part {nextPartNum}.
                            </p>
                            <p className="text-muted-foreground text-xs">
                                Phần Reading không có audio tự phát — bạn tự điều hướng bằng
                                nút Trước / Tiếp.
                            </p>
                        </div>
                    </div>
                </div>
            </ExamShell>
        )
    }

    // ── UI: Directions (Listening + Reading) ──
    if (phase === 'directions' && currentDirections) {
        const partNum = partToNumber(currentDirections.part)
        const sectionLabel = section === 'listening' ? 'Listening' : 'Reading'
        return (
            <ExamShell
                title={play.title}
                partLabel={`${sectionLabel} — Part ${partNum} Directions`}
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

    // ── UI: Listening — audio tự phát, hết thì tự chuyển ──
    if (section === 'listening' && phase === 'answering' && currentUnit) {
        return (
            <ExamShell
                title={play.title}
                partLabel={`Listening — Part ${partToNumber(currentUnit.part)}`}
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

    // ── UI: Reading Part 5–7 — điều hướng thủ công, passage nhóm P6–7 ──
    if (section === 'reading' && phase === 'answering' && currentReadingItem && currentPart) {
        const partNum = partToNumber(currentPart)
        const screenLabel =
            readingItems.length > 1
                ? `Màn ${readingItemIdx + 1}/${readingItems.length}`
                : ''

        const isPassageScreen = currentReadingItem.kind === 'passage'

        return (
            <ExamShell
                title={play.title}
                partLabel={`Reading — Part ${partNum}${screenLabel ? ` · ${screenLabel}` : ''}`}
                answeredCount={answeredCount}
                totalCount={totalQuestions}
                wide={isPassageScreen}
                footer={
                    <div className="flex w-full items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            onClick={goBackReading}
                            disabled={!canGoBackReading}
                        >
                            <ChevronLeft className="w-4 h-4 mr-1" />
                            Trước
                        </Button>
                        <Button onClick={advanceReading}>
                            Tiếp
                            <ChevronRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                }
            >
                {currentReadingItem.kind === 'single' ? (
                    <ReadingSingleScreen
                        question={currentReadingItem.question}
                        selectedId={answers[currentReadingItem.question.questionId]}
                        onSelect={selectOption}
                        isBookmarked={!!bookmarks[currentReadingItem.question.questionId]}
                        onToggleBookmark={() =>
                            toggleBookmark(currentReadingItem.question.questionId)
                        }
                    />
                ) : (
                    <ReadingPassageScreen
                        passage={currentReadingItem.passage}
                        imageUrls={currentReadingItem.imageUrls}
                        questions={currentReadingItem.questions}
                        answers={answers}
                        bookmarks={bookmarks}
                        onSelect={selectOption}
                        onToggleBookmark={toggleBookmark}
                    />
                )}
                <ReadingQuestionPalette
                    open={readingPaletteOpen}
                    onOpenChange={setReadingPaletteOpen}
                    questions={play.questions}
                    partsOrder={readingPartsOrder}
                    answers={answers}
                    bookmarks={bookmarks}
                    currentPartIdx={partIdx}
                    currentReadingItemIdx={readingItemIdx}
                    onJump={jumpToReading}
                />
            </ExamShell>
        )
    }

    // ── Hết bài — sessionId giữ để Bước 8 gọi submit() ──
    const listeningQuestions = play.questions.filter((q) => isListeningPart(q.part))
    const readingQuestions = play.questions.filter((q) => isReadingPart(q.part))
    const isReadingOnlyDone = listeningQuestions.length === 0 && readingQuestions.length > 0

    return (
        <ExamShell
            title={play.title}
            partLabel={isReadingOnlyDone ? 'Kết thúc Reading' : 'Kết thúc bài thi'}
            answeredCount={answeredCount}
            totalCount={totalQuestions}
            footer={
                <div className="flex gap-2 w-full justify-between flex-wrap">
                    <Button variant="outline" onClick={() => navigate(`/mock-test/${id}`)}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Về cấu trúc đề
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleSubmit}
                            disabled={!sessionId || isSubmitting}
                            className="min-w-[120px]"
                        >
                            {isSubmitting ? 'Đang nộp…' : 'Nộp bài'}
                        </Button>
                        <Button variant="outline" onClick={() => navigate('/mock-test')}>
                            Danh sách đề
                        </Button>
                    </div>
                </div>
            }
        >
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                    Đã chọn {answeredCount}/{totalQuestions} câu.
                    {listeningQuestions.length > 0 && (
                        <span className="block">
                            Listening: {play.questions.filter((q) => isListeningPart(q.part) && answers[q.questionId]).length}/
                            {listeningQuestions.length}
                        </span>
                    )}
                    {readingQuestions.length > 0 && (
                        <span className="block">
                            Reading: {play.questions.filter((q) => isReadingPart(q.part) && answers[q.questionId]).length}/
                            {readingQuestions.length}
                        </span>
                    )}
                    {sessionId && (
                        <span className="block text-xs mt-1 text-muted-foreground/80">
                            Đáp án đã lưu tạm trên server — bấm <strong>Nộp bài</strong> để chấm
                            điểm.
                        </span>
                    )}
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

/** Nút đánh dấu câu — chỉ UI local (Day 28) */
function BookmarkToggle({
    active,
    onClick,
    label,
}: {
    active: boolean
    onClick: () => void
    label: string
}) {
    return (
        <Button
            type="button"
            variant={active ? 'default' : 'outline'}
            size="sm"
            onClick={onClick}
            className="shrink-0"
        >
            <Bookmark className={`w-4 h-4 mr-1 ${active ? 'fill-current' : ''}`} />
            {label}
        </Button>
    )
}

/** Part 5 — 1 câu / màn, nội dung câu + đáp án A–D */
function ReadingSingleScreen({
    question,
    selectedId,
    onSelect,
    isBookmarked,
    onToggleBookmark,
}: {
    question: PlayQuestion
    selectedId?: string
    onSelect: (questionId: string, optionId: string) => void
    isBookmarked: boolean
    onToggleBookmark: () => void
}) {
    const options = question.options.filter((o) => o.content?.trim())

    return (
        <div className="rounded-lg border-2 border-[#1a4d7c]/25 bg-white shadow-sm min-h-[calc(100vh-220px)] flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-[#1a4d7c]/15 px-4 py-3">
                <p className="text-lg font-semibold">Câu {question.orderIndex}</p>
                <BookmarkToggle
                    active={isBookmarked}
                    onClick={onToggleBookmark}
                    label={isBookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}
                />
            </div>
            <div className="flex-1 p-6 md:p-8 space-y-8">
                {question.content && (
                    <div
                        className="prose prose-base max-w-none text-lg leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: question.content }}
                    />
                )}
                <div className="space-y-3" role="radiogroup" aria-label={`Câu ${question.orderIndex}`}>
                    {options.map((opt) => {
                        const selected = selectedId === opt.id
                        const inputId = `${question.questionId}-${opt.id}`
                        return (
                            <label
                                key={opt.id}
                                htmlFor={inputId}
                                className={`flex items-start gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                                    selected
                                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                        : 'border-border hover:bg-muted/40'
                                }`}
                            >
                                <input
                                    id={inputId}
                                    type="radio"
                                    name={question.questionId}
                                    value={opt.id}
                                    checked={selected}
                                    onChange={() => onSelect(question.questionId, opt.id)}
                                    className="mt-1 h-5 w-5 shrink-0 accent-blue-600"
                                />
                                <span className="text-base leading-snug">
                                    <span className="font-semibold">{opt.label}.</span>
                                    <span
                                        className="ml-2"
                                        dangerouslySetInnerHTML={{ __html: opt.content }}
                                    />
                                </span>
                            </label>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

/** Part 6–7 — passage/ảnh trái, nhóm câu phải */
function ReadingPassageScreen({
    passage,
    imageUrls,
    questions,
    answers,
    bookmarks,
    onSelect,
    onToggleBookmark,
}: {
    passage: string
    imageUrls: string[]
    questions: PlayQuestion[]
    answers: Record<string, string>
    bookmarks: Record<string, true>
    onSelect: (questionId: string, optionId: string) => void
    onToggleBookmark: (questionId: string) => void
}) {
    const hasImages = imageUrls.length > 0
    const hasPassage = !!passage?.trim() && !isPassageGroupCode(passage)
    const multiImage = imageUrls.length > 1

    return (
        <div className="rounded-lg border-2 border-[#1a4d7c]/25 bg-white shadow-sm overflow-hidden h-[calc(100vh-200px)] w-full">
            <div className="grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] h-full min-h-0">
                {/* Cột trái — ảnh/đoạn văn, cuộn dọc */}
                <div className="flex flex-col h-full min-h-0 border-b lg:border-b-0 lg:border-r border-[#1a4d7c]/20 bg-slate-50/50 min-w-0">
                    <div className="shrink-0 px-2 md:px-3 pt-2 md:pt-3 pb-2 border-b border-[#1a4d7c]/10 bg-white/80">
                        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                            {hasImages ? 'Bài đọc' : 'Đoạn văn'}
                        </p>
                    </div>
                    <div className="exam-reading-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 md:px-3 py-2">
                        {hasImages && (
                            <div
                                className={`pb-2 bg-white ${
                                    multiImage
                                        ? 'border-2 border-slate-800'
                                        : ''
                                }`}
                            >
                                {imageUrls.map((url) => (
                                    <img
                                        key={url}
                                        src={getMediaUrl(url)}
                                        alt="Bài đọc"
                                        className={`block w-full max-w-full h-auto bg-white ${
                                            multiImage
                                                ? ''
                                                : 'border-2 border-slate-800'
                                        }`}
                                    />
                                ))}
                            </div>
                        )}
                        {hasPassage && (
                            <div
                                className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed pb-2"
                                dangerouslySetInnerHTML={{ __html: passage }}
                            />
                        )}
                        {!hasImages && !hasPassage && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                                Thiếu ảnh hoặc đoạn văn — kiểm tra cột Passage / ImageFile trong Excel.
                            </p>
                        )}
                    </div>
                </div>
                <div className="exam-reading-scroll p-3 md:p-4 overflow-y-auto h-full min-h-0 space-y-6 min-w-0">
                    {questions.map((q) => {
                        const options = q.options.filter((o) => o.content?.trim())
                        const selectedId = answers[q.questionId]
                        const isBookmarked = !!bookmarks[q.questionId]
                        return (
                            <div
                                key={q.questionId}
                                className="rounded-lg border border-border/80 p-4 space-y-4 bg-white"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <p className="font-semibold text-lg">Câu {q.orderIndex}</p>
                                    <BookmarkToggle
                                        active={isBookmarked}
                                        onClick={() => onToggleBookmark(q.questionId)}
                                        label={isBookmarked ? 'Đã đánh dấu' : 'Đánh dấu'}
                                    />
                                </div>
                                {q.content && (
                                    <div
                                        className="prose prose-base max-w-none text-base"
                                        dangerouslySetInnerHTML={{ __html: q.content }}
                                    />
                                )}
                                <div className="space-y-2" role="radiogroup" aria-label={`Câu ${q.orderIndex}`}>
                                    {options.map((opt) => {
                                        const selected = selectedId === opt.id
                                        const inputId = `${q.questionId}-${opt.id}`
                                        return (
                                            <label
                                                key={opt.id}
                                                htmlFor={inputId}
                                                className={`flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                                                    selected ? 'bg-blue-50' : 'hover:bg-muted/40'
                                                }`}
                                            >
                                                <input
                                                    id={inputId}
                                                    type="radio"
                                                    name={q.questionId}
                                                    value={opt.id}
                                                    checked={selected}
                                                    onChange={() => onSelect(q.questionId, opt.id)}
                                                    className="mt-1 h-[18px] w-[18px] shrink-0 accent-blue-600"
                                                />
                                                <span className="text-base leading-snug">
                                                    <span className="font-semibold">{opt.label}.</span>
                                                    <span
                                                        className="ml-1"
                                                        dangerouslySetInnerHTML={{ __html: opt.content }}
                                                    />
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
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