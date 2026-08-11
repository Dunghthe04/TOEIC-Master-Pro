/**
 * MockTestStructurePage — màn cấu trúc đề (Day 27 Bước 3).
 * Mục đích: hiện Part + số câu; full hoặc chọn Part → điều hướng sang /play.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TestService } from '@/services/test.service'
import type { TestStructure } from '@/types/test.types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Play } from 'lucide-react'
import { toast } from 'sonner'

import { TestSessionService } from '@/services/test-session.service'
import type { ActiveTestSession } from '@/types/test-session.types'
import { formatExamCountdown } from '@/lib/examTimer'
import { useAuthStore } from '@/store/auth.store'

/** "Part1" → 1 — dùng cho query ?parts=1,2,3 */
function partToNumber(part: string): number {
    const n = Number(String(part).replace(/\D/g, ''))
    return n >= 1 && n <= 7 ? n : 0
}

export default function MockTestStructurePage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()

    const [structure, setStructure] = useState<TestStructure | null>(null)
    const [loading, setLoading] = useState(true)
    /** false = full test (mặc định Zenlish); true = chọn từng Part */
    const [selectPartsMode, setSelectPartsMode] = useState(false)
    /** Các Part đang tick (số 1–7) — chỉ dùng khi selectPartsMode */
    const [selectedParts, setSelectedParts] = useState<number[]>([])

    const [activeSession, setActiveSession] = useState<ActiveTestSession | null>(null)
    /** Popup hỏi tiếp tục — tự mở khi phát hiện bài dở. */
    const [resumeDialogOpen, setResumeDialogOpen] = useState(false)
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

    /** Bài đang làm dở — CHỈ hỏi khi đã đăng nhập. */
    useEffect(() => {
        // Trang này CÔNG KHAI (App.tsx nằm ngoài ProtectedRoute) — khách vãng lai
        // xem được cấu trúc đề. Gọi API khi chưa đăng nhập sẽ dính 401, interceptor
        // thử refresh, thất bại, rồi đá họ về /login — hỏng trải nghiệm xem thử.
        if (!id || !isAuthenticated) return
        let cancelled = false
        TestSessionService.getActive(id)
            .then((s) => {
                if (cancelled) return
                setActiveSession(s)
                if (s) setResumeDialogOpen(true)
            })
            .catch(() => { /* không có bài dở cũng không sao — im lặng */ })
        return () => { cancelled = true }
    }, [id, isAuthenticated])

    /** Tiếp tục bài cũ — dùng Part CỦA BÀI CŨ, không phải ô đang tick. */
    const handleContinue = () => {
        if (!id || !activeSession) return
        const parts = activeSession.partsFilter?.join(',')
        navigate(parts ? `/mock-test/${id}/play?parts=${parts}` : `/mock-test/${id}/play`)
    }

    /**
     * Bỏ hẳn bài đang dở → Status = Abandoned, sau đó bấm "Bắt đầu" là được phiên mới.
     *
     * Nhãn nút CỐ Ý là "Bỏ bài thi" chứ không phải "Hủy": đây là hành động PHÁ HỦY.
     * Nhãn "Hủy" sẽ khiến người chỉ muốn xem cấu trúc đề bấm vào rồi mất bài — hành
     * động phá hủy nấp sau nhãn vô hại. Esc và bấm ra ngoài overlay vẫn chỉ đóng
     * popup, KHÔNG đụng dữ liệu.
     */
    const handleAbandon = async () => {
        if (!activeSession) return
        try {
            await TestSessionService.abandon(activeSession.sessionId)
            setActiveSession(null)
            setResumeDialogOpen(false)
            toast.success('Đã bỏ bài cũ — bấm "Bắt đầu" để làm lại từ đầu.')
        } catch (err: any) {
            toast.error(err?.response?.data?.error ?? 'Không bỏ được bài cũ.')
        }
    }

    /** Load cấu trúc đề published. */
    useEffect(() => {
        if (!id) return
        let cancelled = false
            ; (async () => {
                setLoading(true)
                try {
                    const data = await TestService.getStructure(id)
                    if (cancelled) return
                    setStructure(data)
                    // Mặc định tick hết Part có trong đề (khi user bật chế độ chọn)
                    setSelectedParts(
                        data.parts.map((p) => partToNumber(p.part)).filter((n) => n > 0)
                    )
                } catch {
                    toast.error('Không tải được cấu trúc đề.')
                    navigate('/mock-test')
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => {
            cancelled = true
        }
    }, [id, navigate])

    /** Tổng câu theo Part đang chọn (chế độ chọn Part). */
    const selectedQuestionCount = useMemo(() => {
        if (!structure || !selectPartsMode) return structure?.totalQuestions ?? 0
        return structure.parts
            .filter((p) => selectedParts.includes(partToNumber(p.part)))
            .reduce((sum, p) => sum + p.questionCount, 0)
    }, [structure, selectPartsMode, selectedParts])

    /** Bật/tắt một Part trong danh sách chọn. */
    const togglePart = (partNum: number, checked: boolean) => {
        setSelectedParts((prev) =>
            checked
                ? [...new Set([...prev, partNum])]
                : prev.filter((n) => n !== partNum)
        )
    }

    /**
     * Bắt đầu làm bài.
     * Full → /play (không query parts).
     * Chọn Part → /play?parts=1,2,4
     */
    const handleStart = () => {
        if (!id || !structure) return
        if (selectPartsMode) {
            if (selectedParts.length === 0) {
                toast.error('Chọn ít nhất một Part.')
                return
            }
            const parts = [...selectedParts].sort((a, b) => a - b).join(',')
            navigate(`/mock-test/${id}/play?parts=${parts}`)
            return
        }
        navigate(`/mock-test/${id}/play`)
    }

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
                Đang tải cấu trúc đề…
            </div>
        )
    }

    if (!structure) return null

    const listeningParts = structure.parts.filter((p) => partToNumber(p.part) <= 4)
    const readingParts = structure.parts.filter((p) => partToNumber(p.part) >= 5)
    const listeningCount = listeningParts.reduce((s, p) => s + p.questionCount, 0)
    const readingCount = readingParts.reduce((s, p) => s + p.questionCount, 0)

    /** Padding ô bảng — tránh chữ sát mép khung */
    const cellX = 'px-6 md:px-10'
    const cellY = 'py-4 md:py-5'

    const renderPartRows = (parts: typeof structure.parts) =>
        parts.map((p) => {
            const num = partToNumber(p.part)
            const checked = selectedParts.includes(num)
            return (
                <TableRow key={p.part} className="hover:bg-slate-50/80">
                    {selectPartsMode && (
                        <TableCell className={`${cellX} ${cellY} w-16`}>
                            <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => togglePart(num, v === true)}
                                aria-label={`Chọn ${p.name}`}
                            />
                        </TableCell>
                    )}
                    <TableCell className={`${cellX} ${cellY} font-semibold text-base text-[#1a4d7c]`}>
                        {p.name}
                    </TableCell>
                    <TableCell className={`${cellX} ${cellY} text-right text-base font-medium tabular-nums`}>
                        {p.questionCount}
                        <span className="text-sm font-normal text-muted-foreground ml-1">câu</span>
                    </TableCell>
                </TableRow>
            )
        })

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-[#eef2f6] to-white px-4 py-8 md:py-12">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground -ml-2"
                    onClick={() => navigate('/mock-test')}
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Quay lại danh sách
                </Button>

                {/* Tiêu đề đề — căn giữa */}
                <div className="text-center space-y-2">
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                        {structure.series}
                    </Badge>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[#1a4d7c]">
                        {structure.title}
                    </h1>
                    <p className="text-base text-muted-foreground">
                        {structure.totalQuestions} câu · {structure.durationMinutes} phút (full test)
                    </p>
                </div>

                {/* Khung cấu trúc Part */}
                <div className="rounded-xl border-2 border-[#1a4d7c]/20 bg-white shadow-lg overflow-hidden">
                    <div className="bg-[#1a4d7c] text-white px-8 py-5 text-center">
                        <p className="text-lg font-semibold tracking-wide uppercase">
                            Cấu trúc đề thi
                        </p>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                {selectPartsMode && (
                                    <TableHead className={`w-16 ${cellX} py-3.5`} />
                                )}
                                <TableHead className={`${cellX} py-3.5 text-base font-semibold`}>
                                    Part
                                </TableHead>
                                <TableHead className={`${cellX} py-3.5 text-right text-base font-semibold`}>
                                    Số câu
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {listeningParts.length > 0 && (
                                <>
                                    <TableRow className="bg-[#1a4d7c]/5 hover:bg-[#1a4d7c]/5">
                                        <TableCell
                                            colSpan={selectPartsMode ? 3 : 2}
                                            className={`${cellX} py-3 text-xs font-bold uppercase tracking-wider text-[#1a4d7c]`}
                                        >
                                            Listening · {listeningCount} câu
                                        </TableCell>
                                    </TableRow>
                                    {renderPartRows(listeningParts)}
                                </>
                            )}
                            {readingParts.length > 0 && (
                                <>
                                    <TableRow className="bg-[#f97316]/8 hover:bg-[#f97316]/8">
                                        <TableCell
                                            colSpan={selectPartsMode ? 3 : 2}
                                            className={`${cellX} py-3 text-xs font-bold uppercase tracking-wider text-[#c2410c]`}
                                        >
                                            Reading · {readingCount} câu
                                        </TableCell>
                                    </TableRow>
                                    {renderPartRows(readingParts)}
                                </>
                            )}
                            <TableRow className="bg-slate-100 font-bold hover:bg-slate-100">
                                {selectPartsMode && <TableCell className={cellX} />}
                                <TableCell className={`${cellX} ${cellY} text-base`}>Tổng</TableCell>
                                <TableCell
                                    className={`${cellX} ${cellY} text-right text-base tabular-nums text-[#1a4d7c]`}
                                >
                                    {structure.totalQuestions} câu
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>

                {/* Chế độ chọn Part */}
                <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border bg-white px-6 py-4 shadow-sm">
                    <Checkbox
                        checked={selectPartsMode}
                        onCheckedChange={(v) => setSelectPartsMode(v === true)}
                        className="mt-0.5"
                    />
                    <span>
                        <span className="font-medium text-sm">Chọn từng Part</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                            Tắt = làm full test. Bật = chỉ làm các Part đã tick.
                        </span>
                    </span>
                </label>

                {/* Tóm tắt + nút bắt đầu */}
                <div className="rounded-xl border bg-white px-8 py-6 shadow-sm space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        {selectPartsMode
                            ? `Sẽ làm ${selectedQuestionCount} câu · Part: ${selectedParts.length
                                ? [...selectedParts].sort((a, b) => a - b).join(', ')
                                : '—'
                            }`
                            : `Full test · ${structure.totalQuestions} câu · ~${structure.durationMinutes} phút`}
                    </p>
                    <Button
                        size="lg"
                        onClick={handleStart}
                        disabled={selectPartsMode && selectedParts.length === 0}
                        className="min-w-[200px] bg-[#1a4d7c] hover:bg-[#153d63] text-base h-12"
                    >
                        <Play className="w-5 h-5 mr-2" />
                        Bắt đầu
                    </Button>
                    <Button
                        type="button"
                        variant="link"
                        className="text-sm text-[#1a4d7c]"
                        onClick={() => navigate(`/mock-test/history?testId=${id}`)}
                    >
                        Xem lịch sử đề này
                    </Button>
                </div>
            </div>

            {/*
              Popup hỏi khi CHỦ ĐỘNG vào lại đề. F5 giữa bài thì /play tự khôi phục
              im lặng — không hỏi, vì F5 là tai nạn còn vào lại từ đây là chủ ý.
              "Để sau" đóng popup mà không mất gì: bài cũ vẫn nằm đó, bấm "Bắt đầu"
              cùng phạm vi thì StartAsync vẫn tự khôi phục.
            */}
            <AlertDialog open={resumeDialogOpen} onOpenChange={setResumeDialogOpen}>
                <AlertDialogContent className="max-w-md p-6 sm:p-8 gap-5">
                    <AlertDialogHeader className="text-left place-items-start">
                        <AlertDialogTitle className="text-xl font-semibold">
                            Bạn có một bài đang làm dở
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-1 text-base">
                                <p>
                                    {activeSession?.partsFilter
                                        ? `Part ${activeSession.partsFilter.join(', ')}`
                                        : 'Full đề'}
                                    {' · '}
                                    đã trả lời {activeSession?.answeredCount}/
                                    {activeSession?.questionCount} câu
                                </p>
                                {activeSession?.readingSecondsLeft != null && (
                                    <p className="font-semibold text-[#1a4d7c]">
                                        Còn lại {formatExamCountdown(activeSession.readingSecondsLeft)}
                                    </p>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:gap-3">
                        {/*
                          Button thường, KHÔNG dùng AlertDialogCancel: Cancel đi chung
                          đường với Esc và bấm ra ngoài overlay, nên gắn hành động phá
                          hủy vào đó sẽ khiến người chỉ muốn đóng popup mất luôn bài thi.
                          Tách ra thì Esc / bấm ngoài chỉ đóng popup, không đụng dữ liệu.
                        */}
                        <Button
                            variant="destructive"
                            className="sm:min-w-[130px]"
                            onClick={handleAbandon}
                        >
                            Bỏ bài thi
                        </Button>
                        <AlertDialogAction
                            className="sm:min-w-[150px] bg-[#1a4d7c] hover:bg-[#153d63]"
                            onClick={handleContinue}
                        >
                            Tiếp tục làm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}