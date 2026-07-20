// Luyện nhanh (PHỤ) — random từ kho Question / API Day 25.
// Luồng chính thi thử từ đề import nằm ở /mock-test (Exam Engine Day 26+).
import { useEffect, useMemo, useState } from 'react'
import { PracticeService } from '@/services/practice.service'
import type {
    DifficultyLevel,
    PracticeQuestion,
    PracticeResult,
} from '@/types/practice.types'
import AudioPlayer from '@/components/practice/AudioPlayer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Card, CardContent, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, RotateCcw, Timer } from 'lucide-react'

type Phase = 'setup' | 'doing' | 'result'

const PARTS = [
    { value: 1, label: 'Part 1 — Photographs' },
    { value: 2, label: 'Part 2 — Question-Response' },
    { value: 3, label: 'Part 3 — Conversations' },
    { value: 4, label: 'Part 4 — Talks' },
]

export default function PracticePage() {
    const [phase, setPhase] = useState<Phase>('setup')
    const [part, setPart] = useState('1')
    const [difficulty, setDifficulty] = useState<'all' | DifficultyLevel>('all')
    const [limit, setLimit] = useState('10')
    const [timerOn, setTimerOn] = useState(false)
    const [secondsLeft, setSecondsLeft] = useState(0)

    const [questions, setQuestions] = useState<PracticeQuestion[]>([])
    const [index, setIndex] = useState(0)
    // questionId → optionId đã chọn
    const [answers, setAnswers] = useState<Record<string, string>>({})
    const [result, setResult] = useState<PracticeResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const current = questions[index]

    // Timer đếm ngược — hết giờ tự nộp
    useEffect(() => {
        if (phase !== 'doing' || !timerOn || secondsLeft <= 0) return
        const id = window.setInterval(() => {
            setSecondsLeft(s => {
                if (s <= 1) {
                    window.clearInterval(id)
                    void handleSubmit(true)
                    return 0
                }
                return s - 1
            })
        }, 1000)
        return () => window.clearInterval(id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, timerOn, secondsLeft > 0])

    const answeredCount = useMemo(
        () => questions.filter(q => answers[q.id]).length,
        [questions, answers]
    )

    const start = async () => {
        setLoading(true)
        setResult(null)
        try {
            const data = await PracticeService.getQuestions({
                part: Number(part),
                difficulty: difficulty === 'all' ? undefined : difficulty,
                limit: Number(limit),
            })
            if (data.length === 0) {
                toast.error('Không có câu hỏi phù hợp (cần isPublished = true).')
                return
            }
            setQuestions(data)
            setAnswers({})
            setIndex(0)
            // ~45 giây / câu nếu bật timer
            setSecondsLeft(timerOn ? data.length * 45 : 0)
            setPhase('doing')
        } catch {
            toast.error('Không tải được câu hỏi')
        } finally {
            setLoading(false)
        }
    }

    const selectOption = (questionId: string, optionId: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: optionId }))
    }

    const handleSubmit = async (fromTimer = false) => {
        if (submitting || questions.length === 0) return
        setSubmitting(true)
        try {
            const payload = questions.map(q => ({
                questionId: q.id,
                selectedOptionId: answers[q.id] ?? null,
            }))
            const data = await PracticeService.submit(payload)
            setResult(data)
            setPhase('result')
            if (fromTimer) toast.message('Hết giờ — đã tự nộp bài')
        } catch {
            toast.error('Nộp bài thất bại')
        } finally {
            setSubmitting(false)
        }
    }

    const reset = () => {
        setPhase('setup')
        setQuestions([])
        setAnswers({})
        setResult(null)
        setIndex(0)
    }

    // ── Setup ─────────────────────────────────────────────
    if (phase === 'setup') {
        return (
            <div className="p-6 max-w-xl space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Luyện nhanh — Listening (Part 1–4)</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Luyện phụ từ kho câu hỏi. Muốn làm đề full TOEIC → dùng mục <strong>Thi thử</strong>.
                    </p>
                </div>

                <div className="space-y-4 rounded-lg border p-4">
                    <div className="space-y-2">
                        <Label>Part</Label>
                        <Select value={part} onValueChange={setPart}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {PARTS.map(p => (
                                    <SelectItem key={p.value} value={String(p.value)}>
                                        {p.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Độ khó</Label>
                        <Select
                            value={difficulty}
                            onValueChange={v => setDifficulty(v as 'all' | DifficultyLevel)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả</SelectItem>
                                <SelectItem value="Easy">Dễ</SelectItem>
                                <SelectItem value="Medium">Trung bình</SelectItem>
                                <SelectItem value="Hard">Khó</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Số câu</Label>
                        <Select value={limit} onValueChange={setLimit}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[5, 10, 15, 20].map(n => (
                                    <SelectItem key={n} value={String(n)}>{n} câu</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="timer"
                            checked={timerOn}
                            onCheckedChange={v => setTimerOn(v === true)}
                        />
                        <Label htmlFor="timer" className="flex items-center gap-1">
                            <Timer className="w-4 h-4" /> Bật timer (~45s/câu)
                        </Label>
                    </div>

                    <Button className="w-full" disabled={loading} onClick={start}>
                        {loading ? 'Đang tải...' : 'Bắt đầu luyện'}
                    </Button>
                </div>
            </div>
        )
    }

    // ── Result ────────────────────────────────────────────
    if (phase === 'result' && result) {
        const reviewMap = new Map(result.reviews.map(r => [r.questionId, r]))
        return (
            <div className="p-6 space-y-6 max-w-3xl">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Kết quả luyện</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Đúng {result.correctCount}/{result.totalCount}
                            {' · '}Bỏ qua {result.skippedCount}
                            {' · '}{result.scorePercent}%
                        </p>
                    </div>
                    <Button variant="outline" onClick={reset}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Luyện lại
                    </Button>
                </div>

                <div className="space-y-3">
                    {questions.map((q, i) => {
                        const rev = reviewMap.get(q.id)
                        return (
                            <Card key={q.id}>
                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <CardTitle className="text-base">Câu {i + 1}</CardTitle>
                                        <Badge variant={rev?.isCorrect ? 'default' : 'destructive'}>
                                            {rev?.isCorrect ? 'Đúng' : 'Sai'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-2 text-sm">
                                    <div
                                        className="prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: q.content }}
                                    />
                                    <p>
                                        Đáp án đúng: <strong>{rev?.correctLabel}</strong>
                                    </p>
                                    <p className="text-muted-foreground">{rev?.explanation}</p>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
        )
    }

    // ── Doing ─────────────────────────────────────────────
    if (!current) return null

    return (
        <div className="p-6 space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold">
                        Câu {index + 1}/{questions.length}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Đã chọn {answeredCount}/{questions.length}
                        {timerOn && (
                            <span className="ml-2 font-medium text-orange-600">
                                ⏱ {Math.floor(secondsLeft / 60)}:
                                {String(secondsLeft % 60).padStart(2, '0')}
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={reset}>Thoát</Button>
                    <Button disabled={submitting} onClick={() => handleSubmit(false)}>
                        {submitting ? 'Đang nộp...' : 'Nộp bài'}
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex gap-2">
                        <Badge variant="secondary">{current.part}</Badge>
                        <Badge variant="outline">{current.difficulty}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Part 1: ảnh */}
                    {current.imageUrl && (
                        <img
                            src={current.imageUrl}
                            alt="Part 1"
                            className="max-h-72 rounded-lg border object-contain mx-auto"
                        />
                    )}

                    {/* Part 1–4: audio */}
                    <AudioPlayer src={current.audioUrl} />

                    <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: current.content }}
                    />

                    <div className="space-y-2">
                        {current.options.map(opt => {
                            const selected = answers[current.id] === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => selectOption(current.id, opt.id)}
                                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                                        selected
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <strong className="mr-2">{opt.label}.</strong>
                                    <span dangerouslySetInnerHTML={{ __html: opt.content }} />
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
                <CardFooter className="justify-between">
                    <Button
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => setIndex(i => i - 1)}
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Trước
                    </Button>
                    <Button
                        variant="outline"
                        disabled={index >= questions.length - 1}
                        onClick={() => setIndex(i => i + 1)}
                    >
                        Sau <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}