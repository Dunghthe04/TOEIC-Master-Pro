/**
 * ExamShell — màn thi full màn hình (không sidebar/menu).
 * Giống giao diện phòng thi: header + PART + tiến độ + nội dung đề.
 */
import type { ReactNode } from 'react'

type ExamShellProps = {
    title: string
    partLabel: string
    answeredCount: number
    totalCount: number
    children: ReactNode
    /** Thanh phụ (vd. nút Next ở Directions) */
    footer?: ReactNode
}

export default function ExamShell({
    title,
    partLabel,
    answeredCount,
    totalCount,
    children,
    footer,
}: ExamShellProps) {
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

            {/* Thanh Part + tiến độ */}
            <div className="shrink-0 bg-white border-b px-4 md:px-8 py-2.5 flex items-center justify-between">
                <span className="text-[#1a4d7c] font-bold text-lg md:text-xl uppercase">
                    {partLabel}
                </span>
                <span className="bg-[#f97316] text-white text-sm font-semibold px-3 py-1 rounded">
                    {answeredCount}/{totalCount}
                </span>
            </div>

            {/* Nội dung đề */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="mx-auto max-w-6xl h-full">{children}</div>
            </main>

            {footer && (
                <footer className="shrink-0 border-t bg-white px-4 md:px-8 py-3 flex justify-end">
                    {footer}
                </footer>
            )}
        </div>
    )
}
