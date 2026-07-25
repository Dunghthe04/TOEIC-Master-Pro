/**
 * Bảng số câu Reading — soát lại đáp án / câu đánh dấu (chỉ dùng khi thi Reading).
 */
import { LayoutGrid, X } from 'lucide-react'
import { buildReadingNavByPart } from '@/lib/examReading'
import type { PlayQuestion } from '@/types/test.types'

type ReadingQuestionPaletteProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    questions: PlayQuestion[]
    partsOrder: string[]
    answers: Record<string, string>
    bookmarks: Record<string, true>
    currentPartIdx: number
    currentReadingItemIdx: number
    onJump: (partIdx: number, readingItemIdx: number) => void
}

/** Màu ô theo trạng thái câu */
function navCellStyle(
    questionId: string,
    isCurrent: boolean,
    answers: Record<string, string>,
    bookmarks: Record<string, true>
): string {
    const base =
        'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors'
    const marked = !!bookmarks[questionId]
    const answered = !!answers[questionId]

    if (marked) {
        return `${base} bg-amber-400 text-amber-950 hover:bg-amber-500 ${
            isCurrent ? 'ring-2 ring-[#1a4d7c] ring-offset-2' : ''
        }`
    }
    if (answered) {
        return `${base} bg-[#1a4d7c] text-white hover:bg-[#153d63] ${
            isCurrent ? 'ring-2 ring-amber-400 ring-offset-2' : ''
        }`
    }
    return `${base} bg-slate-400 text-white hover:bg-slate-500 ${
        isCurrent ? 'ring-2 ring-[#1a4d7c] ring-offset-2' : ''
    }`
}

export default function ReadingQuestionPalette({
    open,
    onOpenChange,
    questions,
    partsOrder,
    answers,
    bookmarks,
    currentPartIdx,
    currentReadingItemIdx,
    onJump,
}: ReadingQuestionPaletteProps) {
    const groups = buildReadingNavByPart(questions, partsOrder)

    return (
        <>
            {/* Nút góc trên phải — dưới thanh Part, trên vùng làm bài */}
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                className="fixed top-[7.5rem] right-4 md:right-6 z-[55] flex h-14 w-14 items-center justify-center rounded-lg bg-sky-500 text-white shadow-lg hover:bg-sky-600 transition-colors"
                aria-label={open ? 'Đóng danh sách câu' : 'Mở danh sách câu Reading'}
                aria-expanded={open}
            >
                <LayoutGrid className="h-7 w-7" />
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[60] bg-black/30"
                        aria-label="Đóng"
                        onClick={() => onOpenChange(false)}
                    />
                    <aside
                        className="fixed right-0 top-[7.5rem] bottom-[4.5rem] z-[61] w-full max-w-sm bg-[#eef2f6] shadow-2xl border-l overflow-y-auto"
                        role="dialog"
                        aria-label="Danh sách câu Reading"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
                            <p className="font-semibold text-[#1a4d7c]">Soát câu Reading</p>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                aria-label="Đóng"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-6 p-4">
                            {groups.map((group) => (
                                <section key={group.part}>
                                    <h3 className="mb-3 text-sm font-semibold text-slate-700">
                                        Part {group.partNum}
                                    </h3>
                                    <div className="grid grid-cols-6 gap-2">
                                        {group.questions.map(({ question, partIdx, readingItemIdx }) => {
                                            const isCurrent =
                                                partIdx === currentPartIdx &&
                                                readingItemIdx === currentReadingItemIdx
                                            return (
                                                <button
                                                    key={question.questionId}
                                                    type="button"
                                                    title={`Câu ${question.orderIndex}`}
                                                    className={navCellStyle(
                                                        question.questionId,
                                                        isCurrent,
                                                        answers,
                                                        bookmarks
                                                    )}
                                                    onClick={() => {
                                                        onJump(partIdx, readingItemIdx)
                                                        onOpenChange(false)
                                                    }}
                                                >
                                                    {question.orderIndex}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>

                        <div className="border-t bg-white px-4 py-3 text-xs text-muted-foreground space-y-1">
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full bg-slate-400" />
                                Chưa chọn đáp án
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full bg-[#1a4d7c]" />
                                Đã chọn đáp án
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
                                Đã đánh dấu
                            </p>
                        </div>
                    </aside>
                </>
            )}
        </>
    )
}
