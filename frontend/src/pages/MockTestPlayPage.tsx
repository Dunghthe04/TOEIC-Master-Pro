/**
 * MockTestPlayPage — Directions + Listening (Day 27 Bước 4).
 * Mục đích:
 *  - Load GET /play
 *  - Mỗi Part: Directions (Next chỉ ở đây) → làm câu
 *  - Playlist audio liền (ended → unit kế); P3–4 hiện 3 câu
 *  - Chưa nộp bài (Day 28)
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
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ChevronRight, SkipForward } from 'lucide-react'
import { toast } from 'sonner'

type Phase = 'loading' | 'directions' | 'answering' | 'done'

export default function MockTestPlayPage() {
    const { id } = useParams<{ id: string }>()
    const [search] = useSearchParams()
    const navigate = useNavigate()

    const [play, setPlay] = useState<TestPlay | null>(null)
    const [phase, setPhase] = useState<Phase>('loading')
    /** Index Part Listening đang làm (trong partsOrder) */
    const [partIdx, setPartIdx] = useState(0)
    /** Index unit audio trong Part hiện tại */
    const [unitIdx, setUnitIdx] = useState(0)
    /** questionId → optionId đã chọn */
    const [answers, setAnswers] = useState<Record<string, string>>({})

    const audioRef = useRef<HTMLAudioElement | null>(null)

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
                setAnswers({})
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

    const partsOrder = useMemo(
        () => (play ? listeningPartsInOrder(play.questions) : []),
        [play]
    )

    const currentPart = partsOrder[partIdx] ?? null

    /** Directions của Part đang đứng */
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

    /** Câu Listening của Part hiện tại → units */
    const units: ListeningUnit[] = useMemo(() => {
        if (!play || !currentPart) return []
        const qs = play.questions.filter((q) => q.part === currentPart)
        return buildListeningUnits(qs)
    }, [play, currentPart])

    const currentUnit = units[unitIdx] ?? null

    const answeredCount = useMemo(() => {
        if (!play) return 0
        return play.questions.filter((q) => answers[q.questionId]).length
    }, [play, answers])

    /** Dừng audio đang phát (đổi phase / unmount). */
    function stopAudio() {
        const a = audioRef.current
        if (!a) return
        a.pause()
        a.removeAttribute('src')
        a.load()
        audioRef.current = null
    }

    /**
     * Phát 1 URL; hết bài gọi onEnded (playlist liền).
     * Preload nhẹ — browser play track kế ngay khi ended.
     */
    const playUrl = useCallback((url: string | null | undefined, onEnded: () => void) => {
        stopAudio()
        if (!url) {
            onEnded()
            return
        }
        const audio = new Audio(url)
        audio.preload = 'auto'
        audioRef.current = audio
        const handleEnded = () => onEnded()
        audio.addEventListener('ended', handleEnded)
        audio.play().catch(() => {
            // Autoplay bị chặn → user bấm Next / tương tác
            toast.message('Trình duyệt chặn tự phát — bấm Next hoặc tương tác trang.')
        })
        // cleanup listener khi stop/đổi src
        audio.addEventListener(
            'emptied',
            () => audio.removeEventListener('ended', handleEnded),
            { once: true }
        )
    }, [])

    /** Sang làm câu Part hiện tại (sau Directions hoặc skip). */
    const enterAnswering = useCallback(() => {
        stopAudio()
        setUnitIdx(0)
        setPhase('answering')
    }, [])

    /** Directions: hết audio intro → tự vào làm bài (trừ khi đã skip). */
    useEffect(() => {
        if (phase !== 'directions' || !currentDirections) return
        playUrl(currentDirections.audioUrl, () => {
            enterAnswering()
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, currentPart])

    /** Answering: phát audio unit; ended → unit kế / Part kế. */
    const advanceAfterUnit = useCallback(() => {
        setUnitIdx((i) => {
            const next = i + 1
            if (next < units.length) return next

            // Hết units Part này → Part Listening tiếp hoặc done
            setPartIdx((p) => {
                const nextPart = p + 1
                if (nextPart < partsOrder.length) {
                    setPhase('directions')
                    setUnitIdx(0)
                    return nextPart
                }
                setPhase('done')
                return p
            })
            return i
        })
    }, [units.length, partsOrder.length])

    useEffect(() => {
        if (phase !== 'answering' || !currentUnit) return
        playUrl(currentUnit.audioUrl, () => {
            advanceAfterUnit()
        })
        return () => stopAudio()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, partIdx, unitIdx, currentUnit?.audioUrl])

    /** Next chỉ trên Directions — bỏ qua audio intro. */
    const skipDirections = () => {
        stopAudio()
        enterAnswering()
    }

    const selectOption = (questionId: string, optionId: string) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    }

    if (phase === 'loading' || !play) {
        return (
            <div className="p-6 text-sm text-muted-foreground">Đang tải bài thi…</div>
        )
    }

    // ── Directions ──────────────────────────────────────────
    if (phase === 'directions' && currentDirections) {
        return (
            <div className="p-6 max-w-3xl mx-auto space-y-4">
                <HeaderBar
                    play={play}
                    answeredCount={answeredCount}
                    onExit={() => navigate(`/mock-test/${id}`)}
                />
                <Badge>Directions · {currentDirections.part}</Badge>
                <h2 className="text-xl font-bold">Hướng dẫn Part</h2>
                <p className="text-sm text-muted-foreground">
                    Nghe intro (Listening) hoặc bấm Next để làm luôn.
                </p>
                <img
                    src={currentDirections.imageUrl}
                    alt={`Directions ${currentDirections.part}`}
                    className="w-full max-h-[70vh] object-contain rounded-lg border bg-white"
                />
                {/* Nút Next CHỈ hiện ở Directions */}
                <div className="flex justify-end">
                    <Button onClick={skipDirections}>
                        Next
                        <SkipForward className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>
        )
    }

    // ── Answering Listening ─────────────────────────────────
    if (phase === 'answering' && currentUnit) {
        return (
            <div className="p-6 max-w-3xl mx-auto space-y-4">
                <HeaderBar
                    play={play}
                    answeredCount={answeredCount}
                    onExit={() => navigate(`/mock-test/${id}`)}
                />
                <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">{currentUnit.part}</Badge>
                    <span className="text-muted-foreground">
                        Nhóm {unitIdx + 1}/{units.length}
                        {currentUnit.questions.length > 1 &&
                            ` · ${currentUnit.questions.length} câu cùng băng`}
                    </span>
                </div>

                <p className="text-xs text-muted-foreground">
                    Audio chạy liên tục — hết băng tự sang nhóm / Part tiếp.
                </p>

                <div className="space-y-6">
                    {currentUnit.questions.map((q) => (
                        <QuestionBlock
                            key={q.questionId}
                            question={q}
                            selectedId={answers[q.questionId]}
                            onSelect={selectOption}
                        />
                    ))}
                </div>

                {/* Không phải Next Directions — chỉ nhảy nhóm nếu audio lỗi / muốn bỏ qua */}
                <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => {
                        stopAudio()
                        advanceAfterUnit()
                    }}>
                        Nhóm tiếp
                        <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </div>
            </div>
        )
    }

    // ── Hết Listening ───────────────────────────────────────
    return (
        <div className="p-6 max-w-xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold">Hết phần Listening</h1>
            <p className="text-sm text-muted-foreground">
                Đã chọn {answeredCount}/{play.questions.filter((q) => isListeningPart(q.part)).length} câu Listening.
                Reading + nộp session = Day 28.
            </p>
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/mock-test/${id}`)}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Về cấu trúc
                </Button>
                <Button onClick={() => navigate('/mock-test')}>Danh sách đề</Button>
            </div>
        </div>
    )
}

/** Header chung: tên đề + tiến độ chọn đáp án. */
function HeaderBar({
    play,
    answeredCount,
    onExit,
}: {
    play: TestPlay
    answeredCount: number
    onExit: () => void
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h1 className="text-lg font-bold">{play.title}</h1>
                <p className="text-xs text-muted-foreground">
                    {play.series} · đã chọn {answeredCount}/{play.questions.length}
                </p>
            </div>
            <Button variant="outline" size="sm" onClick={onExit}>
                Thoát
            </Button>
        </div>
    )
}

/** Một câu: ảnh (P1) + nội dung + A/B/C/D. */
function QuestionBlock({
    question,
    selectedId,
    onSelect,
}: {
    question: PlayQuestion
    selectedId?: string
    onSelect: (questionId: string, optionId: string) => void
}) {
    return (
        <div className="rounded-lg border p-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">
                Câu {question.orderIndex}
            </div>
            {question.imageUrl && (
                <img
                    src={question.imageUrl}
                    alt=""
                    className="max-h-64 mx-auto rounded border object-contain"
                />
            )}
            {question.content && (
                <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: question.content }}
                />
            )}
            <div className="space-y-2">
                {question.options.map((opt) => {
                    const selected = selectedId === opt.id
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onSelect(question.questionId, opt.id)}
                            className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                                selected
                                    ? 'border-blue-600 bg-blue-50'
                                    : 'hover:bg-muted/50'
                            }`}
                        >
                            <strong className="mr-2">{opt.label}.</strong>
                            <span dangerouslySetInnerHTML={{ __html: opt.content }} />
                        </button>
                    )
                })}
            </div>
        </div>
    )
}