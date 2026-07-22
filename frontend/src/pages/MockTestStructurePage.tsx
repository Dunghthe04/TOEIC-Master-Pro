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
import { ArrowLeft, Play } from 'lucide-react'
import { toast } from 'sonner'

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

    /** Load cấu trúc đề published. */
    useEffect(() => {
        if (!id) return
        let cancelled = false
        ;(async () => {
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
            <div className="p-6 text-sm text-muted-foreground">Đang tải cấu trúc đề…</div>
        )
    }

    if (!structure) return null

    return (
        <div className="p-6 max-w-3xl space-y-6">
            <Button variant="ghost" size="sm" onClick={() => navigate('/mock-test')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Quay lại danh sách
            </Button>

            <div className="space-y-1">
                <Badge variant="secondary">{structure.series}</Badge>
                <h1 className="text-2xl font-bold">{structure.title}</h1>
                <p className="text-sm text-muted-foreground">
                    {structure.totalQuestions} câu · {structure.durationMinutes} phút (full)
                </p>
            </div>

            {/* Bảng Part */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {selectPartsMode && <TableHead className="w-12" />}
                            <TableHead>Part</TableHead>
                            <TableHead className="text-right">Số câu</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {structure.parts.map((p) => {
                            const num = partToNumber(p.part)
                            const checked = selectedParts.includes(num)
                            return (
                                <TableRow key={p.part}>
                                    {selectPartsMode && (
                                        <TableCell>
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(v) =>
                                                    togglePart(num, v === true)
                                                }
                                                aria-label={`Chọn ${p.name}`}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-right">
                                        {p.questionCount} câu
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Chế độ full vs chọn Part */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
                <Checkbox
                    checked={selectPartsMode}
                    onCheckedChange={(v) => setSelectPartsMode(v === true)}
                    className="mt-0.5"
                />
                <span>
                    <span className="font-medium text-sm">Chọn từng Part</span>
                    <span className="block text-xs text-muted-foreground">
                        Tắt = làm full test. Bật = chỉ làm các Part đã tick.
                    </span>
                </span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                    {selectPartsMode
                        ? `Sẽ làm ${selectedQuestionCount} câu · Part: ${
                              selectedParts.length
                                  ? [...selectedParts].sort((a, b) => a - b).join(', ')
                                  : '—'
                          }`
                        : `Full test · ${structure.totalQuestions} câu · ~${structure.durationMinutes}′`}
                </p>
                <Button onClick={handleStart} disabled={selectPartsMode && selectedParts.length === 0}>
                    <Play className="w-4 h-4 mr-2" />
                    Bắt đầu
                </Button>
            </div>
        </div>
    )
}