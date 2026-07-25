/**
 * ExamShell — màn thi full màn hình (không sidebar/menu).
 * Giống giao diện phòng thi: header + PART + tiến độ + nội dung đề.
 */
import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { formatExamCountdown, READING_TIMER_WARNING_SECONDS } from '@/lib/examTimer'

type ExamShellProps = {
    title: string
    partLabel: string
    answeredCount: number
    totalCount: number
    children: ReactNode
    /** Thanh phụ (vd. nút Next ở Directions) */
    footer?: ReactNode
    /** Mở rộng vùng nội dung (Part 6–7 passage ảnh) */
    wide?: boolean
    /**
     * Giây còn lại của timer Reading — null/undefined = không hiện (Listening).
     */
    timerSeconds?: number | null
    /** Nút NỘP BÀI (Reading) — hiện cạnh timer / tiến độ */
    submitControl?: ReactNode
}

export default function ExamShell({
    title,
    partLabel,
    answeredCount,
    totalCount,
    children,
    footer,
    wide = false,
    timerSeconds = null,
    submitControl,
}: ExamShellProps) {
    const showTimer = timerSeconds != null
    const isTimerWarning =
        showTimer && timerSeconds <= READING_TIMER_WARNING_SECONDS

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#eef2f6]">
            {/* Header hệ thống */}
            <header className="shrink-0 bg-[#1a4d7c] text-white px-4 md:px-8 py-3 flex items-center justify-between">
                <span className="font-semibold tracking-wide text-sm md:text-base">
                    TOEIC MASTER — THI THỬ
                </span>
                <span className="text-xs md:text-sm text-white/85 truncate max-w-[40%]">
                    {title}
                </span>
            </header>

            {/* Thanh Part + timer (Reading) + tiến độ */}
            <div className="shrink-0 bg-white border-b px-4 md:px-8 py-2.5 flex items-center justify-between gap-3">
                <span className="text-[#1a4d7c] font-bold text-lg md:text-xl uppercase min-w-0 truncate">
                    {partLabel}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                    {submitControl}
                    {showTimer && (
                        <span
                            className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums px-3 py-1 rounded border ${
                                isTimerWarning
                                    ? 'bg-red-600 text-white border-red-700'
                                    : 'bg-[#1a4d7c] text-white border-[#153d63]'
                            }`}
                            title="Thời gian còn lại — Reading"
                        >
                            <Clock className="w-4 h-4 shrink-0" />
                            {formatExamCountdown(timerSeconds)}
                        </span>
                    )}
                    <span className="bg-[#f97316] text-white text-sm font-semibold px-3 py-1 rounded">
                        {answeredCount}/{totalCount}
                    </span>
                </div>
            </div>

            {/* Nội dung đề */}
            <main
                className={`flex-1 overflow-y-auto ${wide ? 'p-2 md:p-3' : 'p-4 md:p-6'}`}
            >
                <div
                    className={`mx-auto h-full w-full ${wide ? 'max-w-[min(100%,1600px)]' : 'max-w-6xl'}`}
                >
                    {children}
                </div>
            </main>

            {footer && (
                <footer className="shrink-0 border-t bg-white px-4 md:px-8 py-3 flex justify-end">
                    {footer}
                </footer>
            )}
        </div>
    )
}
