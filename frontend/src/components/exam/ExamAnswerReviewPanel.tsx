/**
 * Chi tiết từng câu sau nộp bài — đáp án user chọn vs đáp án đúng.
 */
import { useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Circle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isListeningPart, partToNumber } from '@/lib/examListening'
import { isReadingPart, parseQuestionImageUrls } from '@/lib/examReading'
import { getMediaUrl } from '@/lib/media'
import type { PlayQuestion } from '@/types/test.types'
import type { SessionAnswerReview } from '@/types/test-session.types'

type Filter = 'all' | 'correct' | 'wrong' | 'skipped'

type ExamAnswerReviewPanelProps = {
    reviews: SessionAnswerReview[]
    questions: PlayQuestion[]
    onBack: () => void
}

export default function ExamAnswerReviewPanel({
    reviews,
    questions,
    onBack,
}: ExamAnswerReviewPanelProps) {
    const [filter, setFilter] = useState<Filter>('all')

    const questionMap = useMemo(() => {
        const m = new Map<string, PlayQuestion>()
        for (const q of questions) m.set(q.questionId, q)
        return m
    }, [questions])

    /** Ảnh dùng chung trong nhóm (Listening P3–4 / Reading P6–7, có thể nhiều ảnh) */
    const imageUrlForReview = useMemo(() => {
        const byAudio = new Map<string, string>()
        const byPassage = new Map<string, string>()
        for (const q of questions) {
            if (q.audioUrl && q.imageUrl) byAudio.set(q.audioUrl, q.imageUrl)
            const passage = q.passage?.trim()
            if (passage && q.imageUrl) byPassage.set(passage, q.imageUrl)
            if (q.imageUrl) byPassage.set(`img:${q.imageUrl}`, q.imageUrl)
        }
        return (q: PlayQuestion) => {
            if (q.imageUrl) return q.imageUrl
            if (q.audioUrl) return byAudio.get(q.audioUrl) ?? null
            const passage = q.passage?.trim()
            if (passage) return byPassage.get(passage) ?? null
            return null
        }
    }, [questions])

    const readingImagesForReview = useMemo(() => {
        const byPassage = new Map<string, string[]>()
        for (const q of questions) {
            if (!isReadingPart(q.part) || partToNumber(q.part) < 6) continue
            const passage = q.passage?.trim()
            const key = passage ? `pass:${passage}` : `img:${q.imageUrl ?? ''}`
            if (!key || key === 'img:') continue
            const list = byPassage.get(key) ?? []
            for (const u of parseQuestionImageUrls(q.imageUrl)) {
                if (!list.includes(u)) list.push(u)
            }
            byPassage.set(key, list)
        }
        return (q: PlayQuestion): string[] => {
            const passage = q.passage?.trim()
            if (passage) return byPassage.get(`pass:${passage}`) ?? []
            return parseQuestionImageUrls(q.imageUrl)
        }
    }, [questions])

    const sorted = useMemo(
        () => [...reviews].sort((a, b) => a.orderIndex - b.orderIndex),
        [reviews]
    )

    const filtered = useMemo(() => {
        if (filter === 'correct') return sorted.filter((r) => r.isCorrect)
        if (filter === 'wrong') return sorted.filter((r) => !r.isCorrect && r.selectedOptionId)
        if (filter === 'skipped') return sorted.filter((r) => !r.selectedOptionId)
        return sorted
    }, [sorted, filter])

    const wrongCount = sorted.filter((r) => !r.isCorrect && r.selectedOptionId).length
    const skippedCount = sorted.filter((r) => !r.selectedOptionId).length
    const correctCount = sorted.filter((r) => r.isCorrect).length

    return (
        <div className="space-y-4 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Quay lại chứng chỉ
                </Button>
                <div className="flex flex-wrap gap-2 text-sm">
                    <FilterChip
                        active={filter === 'all'}
                        onClick={() => setFilter('all')}
                        label={`Tất cả (${sorted.length})`}
                    />
                    <FilterChip
                        active={filter === 'wrong'}
                        onClick={() => setFilter('wrong')}
                        label={`Sai (${wrongCount})`}
                    />
                    <FilterChip
                        active={filter === 'skipped'}
                        onClick={() => setFilter('skipped')}
                        label={`Bỏ qua (${skippedCount})`}
                    />
                    <FilterChip
                        active={filter === 'correct'}
                        onClick={() => setFilter('correct')}
                        label={`Đúng (${correctCount})`}
                    />
                </div>
            </div>

            <ul className="space-y-3">
                {filtered.map((r, idx) => {
                    const question = questionMap.get(r.questionId)
                    const selectedLabel = r.selectedOptionId
                        ? question?.options.find((o) => o.id === r.selectedOptionId)?.label
                        : null
                    const reviewImage = question ? imageUrlForReview(question) : null
                    const reviewReadingImages = question ? readingImagesForReview(question) : []
                    const prevReadingImages =
                        idx > 0
                            ? readingImagesForReview(
                                  questionMap.get(filtered[idx - 1].questionId)!
                              )
                            : []
                    const showReadingImage =
                        !!question &&
                        isReadingPart(question.part) &&
                        partToNumber(question.part) >= 6 &&
                        reviewReadingImages.length > 0 &&
                        reviewReadingImages.join('|') !== prevReadingImages.join('|')

                    return (
                        <li
                            key={r.questionId}
                            className={`rounded-lg border bg-white p-4 space-y-3 ${
                                r.isCorrect
                                    ? 'border-emerald-200'
                                    : !r.selectedOptionId
                                      ? 'border-amber-200'
                                      : 'border-red-200'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {r.isCorrect ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                    ) : !r.selectedOptionId ? (
                                        <Circle className="w-5 h-5 text-amber-500 shrink-0" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                                    )}
                                    <span className="font-semibold text-sm">
                                        Câu {r.orderIndex} — Part {partToNumber(r.part)}
                                    </span>
                                </div>
                                <StatusBadge
                                    isCorrect={r.isCorrect}
                                    skipped={!r.selectedOptionId}
                                />
                            </div>

                            {question?.content && (
                                <div
                                    className="prose prose-sm max-w-none text-sm border-l-2 border-gray-200 pl-3"
                                    dangerouslySetInnerHTML={{ __html: question.content }}
                                />
                            )}

                            {question && isListeningPart(question.part) && (
                                <ListeningReviewMedia
                                    question={question}
                                    imageUrl={imageUrlForReview(question)}
                                />
                            )}

                            {showReadingImage && (
                                <div className="rounded-md border bg-slate-50/90 p-3 space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground">
                                        Ảnh bài đọc
                                    </p>
                                    <div
                                        className={
                                            reviewReadingImages.length > 1
                                                ? 'grid sm:grid-cols-2 gap-3'
                                                : ''
                                        }
                                    >
                                        {reviewReadingImages.map((url) => (
                                            <img
                                                key={url}
                                                src={getMediaUrl(url)}
                                                alt=""
                                                className="w-full max-h-80 object-contain rounded border bg-white mx-auto"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                <div className="rounded-md bg-muted/50 px-3 py-2">
                                    <span className="text-muted-foreground">Bạn chọn: </span>
                                    <span className="font-semibold">
                                        {selectedLabel ?? '— (bỏ qua)'}
                                    </span>
                                </div>
                                <div className="rounded-md bg-emerald-50 px-3 py-2">
                                    <span className="text-muted-foreground">Đáp án đúng: </span>
                                    <span className="font-semibold text-emerald-800">
                                        {r.correctLabel}
                                    </span>
                                </div>
                            </div>

                            {question && (
                                <div className="space-y-1.5 pt-1">
                                    {question.options
                                        .filter((o) => o.content?.trim())
                                        .map((opt) => {
                                            const isUser = opt.id === r.selectedOptionId
                                            const isCorrect = opt.id === r.correctOptionId
                                            return (
                                                <div
                                                    key={opt.id}
                                                    className={`text-sm rounded px-2 py-1.5 border ${
                                                        isCorrect
                                                            ? 'border-emerald-500 bg-emerald-50'
                                                            : isUser
                                                              ? 'border-red-400 bg-red-50'
                                                              : 'border-transparent'
                                                    }`}
                                                >
                                                    <strong>{opt.label}.</strong>{' '}
                                                    <span
                                                        dangerouslySetInnerHTML={{
                                                            __html: opt.content,
                                                        }}
                                                    />
                                                    {isCorrect && (
                                                        <span className="ml-2 text-xs text-emerald-700 font-medium">
                                                            ✓ Đúng
                                                        </span>
                                                    )}
                                                    {isUser && !isCorrect && (
                                                        <span className="ml-2 text-xs text-red-600 font-medium">
                                                            ✗ Bạn chọn
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })}
                                </div>
                            )}

                            {r.explanation && (
                                <div className="text-xs text-muted-foreground border-t pt-2">
                                    <span className="font-medium text-gray-700">Giải thích: </span>
                                    <span dangerouslySetInnerHTML={{ __html: r.explanation }} />
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            {filtered.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                    Không có câu nào trong bộ lọc này.
                </p>
            )}
        </div>
    )
}

/** Audio + ảnh Listening — user nghe/soát lại từng câu sau khi nộp bài */
function ListeningReviewMedia({
    question,
    imageUrl,
}: {
    question: PlayQuestion
    imageUrl: string | null
}) {
    const partNum = partToNumber(question.part)
    const hasImage = !!imageUrl
    const hasAudio = !!question.audioUrl

    if (!hasImage && !hasAudio) {
        return (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Câu này thiếu file audio/ảnh — kiểm tra import.
            </p>
        )
    }

    return (
        <div
            className={`rounded-md border bg-slate-50/90 p-3 gap-3 ${
                partNum === 1 && hasImage
                    ? 'grid md:grid-cols-2 items-start'
                    : 'flex flex-col'
            }`}
        >
            {hasImage && (
                <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Ảnh câu hỏi</p>
                    <img
                        src={getMediaUrl(imageUrl)}
                        alt=""
                        className="w-full max-h-64 object-contain rounded border bg-white mx-auto"
                    />
                </div>
            )}
            {hasAudio && (
                <div className={hasImage && partNum === 1 ? 'min-w-0' : 'w-full'}>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Audio</p>
                    <audio
                        controls
                        preload="none"
                        src={getMediaUrl(question.audioUrl)}
                        className="w-full"
                    />
                </div>
            )}
        </div>
    )
}

function FilterChip({
    active,
    onClick,
    label,
}: {
    active: boolean
    onClick: () => void
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                active
                    ? 'bg-[#1a4d7c] text-white border-[#1a4d7c]'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
        >
            {label}
        </button>
    )
}

function StatusBadge({
    isCorrect,
    skipped,
}: {
    isCorrect: boolean
    skipped: boolean
}) {
    if (isCorrect) {
        return (
            <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                Đúng
            </span>
        )
    }
    if (skipped) {
        return (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                Bỏ qua
            </span>
        )
    }
    return (
        <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded">
            Sai
        </span>
    )
}
