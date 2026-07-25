/**

 * Chứng chỉ điểm mô phỏng — layout theo mẫu TOEIC Master Pro (SAMPLE).

 * Hiển thị sau khi nộp bài; không có giá trị pháp lý.

 */

import { BookOpen, Download, Headphones } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { buildCertificateFilename, downloadElementAsPng } from '@/lib/downloadCertificate'
import { getMediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'



export type ToeicSampleCertificateProps = {
    fullName: string
    avatarUrl?: string | null
    /** Bộ đề — vd. ETS2026 */
    testSeries: string
    /** Tên bài thi — vd. Test 01 */
    testTitle: string
    startedAt: string
    completedAt: string
    listeningScore: number | null
    readingScore: number | null
    totalScore: number | null
    onViewDetails?: () => void
}



/** yyyy/mm/dd HH:mm:ss */

export function formatCertificateDateTime(iso: string): string {

    const d = new Date(iso)

    const y = d.getFullYear()

    const m = String(d.getMonth() + 1).padStart(2, '0')

    const day = String(d.getDate()).padStart(2, '0')

    const h = String(d.getHours()).padStart(2, '0')

    const min = String(d.getMinutes()).padStart(2, '0')

    const s = String(d.getSeconds()).padStart(2, '0')

    return `${y}/${m}/${day} ${h}:${min}:${s}`

}



function scoreToPercent(score: number): number {

    return Math.min(100, Math.max(0, ((score - 5) / 490) * 100))

}

/** Vị trí marker trên thanh — tránh dính sát mép (điểm 5 che nhãn). */
function scoreMarkerLeftPercent(score: number): number {
    const pct = scoreToPercent(score)
    return Math.min(96, Math.max(8, pct))
}



export default function ToeicSampleCertificate({
    fullName,
    avatarUrl,
    testSeries,
    testTitle,
    startedAt,
    completedAt,
    listeningScore,
    readingScore,
    totalScore,
    onViewDetails,
}: ToeicSampleCertificateProps) {
    const photoSrc = avatarUrl ? getMediaUrl(avatarUrl) : ''
    const certificateRef = useRef<HTMLDivElement>(null)
    const [isDownloading, setIsDownloading] = useState(false)

    const handleDownload = useCallback(async () => {
        const el = certificateRef.current
        if (!el || isDownloading) return
        setIsDownloading(true)
        try {
            await downloadElementAsPng(
                el,
                buildCertificateFilename(testSeries, testTitle)
            )
            toast.success('Đã tải chứng chỉ SAMPLE.')
        } catch {
            toast.error('Không tải được chứng chỉ — thử lại.')
        } finally {
            setIsDownloading(false)
        }
    }, [isDownloading, testSeries, testTitle])

    return (
        <div className="w-full max-w-5xl mx-auto">
            <div
                ref={certificateRef}
                className="border-2 border-[#e85d04] bg-white shadow-xl overflow-hidden"
            >

                {/* Header */}

                <div className="flex items-stretch border-b-2 border-[#e85d04]/30 min-h-[46px]">
                    <div className="flex items-center gap-1 px-4 py-2 shrink-0 bg-white">
                        <span className="text-xl font-bold italic text-[#1a4d7c] leading-none">TOEIC</span>
                        <span className="text-base font-bold text-[#e85d04] leading-none">MASTER</span>

                        <span className="bg-[#e85d04] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm">

                            PRO

                        </span>

                    </div>

                    <div className="flex-1 bg-[#e85d04] flex items-center justify-center px-4">

                        <p className="text-white text-[11px] md:text-[13px] font-bold text-center uppercase tracking-wider leading-tight">

                            Listening and Reading Practice Score Certificate

                        </p>

                    </div>

                </div>



                {/* Body */}

                <div className="relative flex flex-col xl:flex-row min-h-[268px]">

                    {/* Watermark */}

                    <div

                        className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"

                        aria-hidden

                    >

                        <span className="text-[#dc2626]/12 text-7xl xl:text-[100px] font-black tracking-[0.3em] -rotate-[22deg]">

                            SAMPLE

                        </span>

                    </div>



                    {/* Trái: ảnh + thông tin — lưới giống chứng chỉ TOEIC */}

                    <CandidateInfoPanel
                        fullName={fullName}
                        photoSrc={photoSrc}
                        testSeries={testSeries}
                        testTitle={testTitle}
                        startedAt={startedAt}
                        completedAt={completedAt}
                    />



                    {/* Giữa: Listening + Reading — luôn hiện cả 2 thanh (partial test: section chưa làm = —) */}

                    <div className="flex-[1.15] flex flex-col justify-center gap-6 px-4 md:px-5 py-5 z-[1] border-b xl:border-b-0 xl:border-r border-gray-300 min-w-0">

                        <ScoreBarRow
                            icon={<Headphones className="w-4 h-4" strokeWidth={2.5} />}
                            label="LISTENING"
                            score={listeningScore}
                        />

                        <ScoreBarRow
                            icon={<BookOpen className="w-4 h-4" strokeWidth={2.5} />}
                            label="READING"
                            score={readingScore}
                        />

                    </div>



                    {/* Phải: Total */}

                    <div className="w-full xl:w-[152px] flex flex-col z-[1] shrink-0 border-t xl:border-t-0 border-gray-300">
                        <div className="bg-[#dc2626] text-white text-[9px] font-bold px-2 py-1.5 text-center leading-snug tracking-wide">

                            SAMPLE — NOT OFFICIAL CERTIFICATE

                        </div>

                        <div className="flex flex-col items-center justify-center flex-1 py-4 xl:py-3 xl:min-h-[210px] gap-2 bg-gradient-to-b from-white to-orange-50/30">
                            <p className="text-[#e85d04] font-extrabold text-[10px] tracking-[0.15em]">
                                TOTAL SCORE
                            </p>
                            <div className="w-[100px] h-[100px] md:w-[108px] md:h-[108px] rounded-full border-[5px] border-[#e85d04] flex items-center justify-center bg-white shadow-[0_4px_16px_rgba(232,93,4,0.12)]">
                                <span className="text-[36px] md:text-[40px] font-bold text-gray-900 tabular-nums leading-none">

                                        {totalScore ?? '—'}

                                </span>
                            </div>
                        </div>

                    </div>

                </div>



                {/* Footer */}

                <div className="border-t border-gray-300 px-4 py-2 bg-[#f5f0ea]">

                    <p className="text-[10px] text-gray-600 text-center leading-relaxed">

                        Chứng chỉ mô phỏng — chỉ mang tính tham khảo, không có giá trị pháp lý. | This

                        is a simulated practice score certificate for reference only.

                    </p>

                </div>

            </div>

            <div className="flex flex-wrap justify-center gap-3 mt-6">
                {onViewDetails && (
                    <Button
                        type="button"
                        onClick={onViewDetails}
                        className="bg-[#1a4d7c] hover:bg-[#153d63] text-white font-semibold px-6"
                    >
                        Xem chi tiết câu hỏi và đáp án
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className="font-semibold px-6"
                >
                    <Download className="w-4 h-4 mr-2" />
                    {isDownloading ? 'Đang tải…' : 'Tải chứng chỉ'}
                </Button>
            </div>
        </div>
    )
}



/** Cột trái: ảnh + lưới thông tin 3 hàng (giống chứng chỉ TOEIC) */
function CandidateInfoPanel({
    fullName,
    photoSrc,
    testSeries,
    testTitle,
    startedAt,
    completedAt,
}: {
    fullName: string
    photoSrc: string
    testSeries: string
    testTitle: string
    startedAt: string
    completedAt: string
}) {
    return (
        <div className="flex shrink-0 z-[1] border-b xl:border-b-0 xl:border-r border-gray-300 bg-[#faf8f5] w-full xl:w-[min(38%,360px)]">
            {/* Ảnh vuông — căn giữa theo chiều dọc */}
            <div className="w-[88px] md:w-[96px] shrink-0 border-r border-gray-300 flex items-center justify-center p-1.5 bg-[#f3f4f6]">
                {photoSrc ? (
                    <img
                        src={photoSrc}
                        alt=""
                        crossOrigin="anonymous"
                        className="w-full aspect-square object-cover border border-gray-400 bg-white"
                    />
                ) : (
                    <div className="w-full aspect-square bg-white border border-gray-400" />
                )}
            </div>

            {/* Lưới: Name | Series+Test | Start+End */}
            <div className="flex-1 grid grid-rows-3 min-w-0 bg-white">
                <CertField
                    value={fullName}
                    label="Name"
                    className="border-b border-gray-300"
                    valueClassName="text-[14px] font-bold text-gray-900 leading-snug"
                />
                <div className="grid grid-cols-2 border-b border-gray-300">
                    <CertField
                        value={testSeries || '—'}
                        label="Test Series"
                        className="border-r border-gray-300"
                        valueClassName="text-[12px] font-semibold text-gray-900"
                    />
                    <CertField
                        value={testTitle || '—'}
                        label="Test"
                        valueClassName="text-[12px] font-semibold text-gray-900"
                    />
                </div>
                <div className="grid grid-cols-2">
                    <CertField
                        value={formatCertificateDateTime(startedAt)}
                        label="Start Time"
                        className="border-r border-gray-300"
                        valueClassName="text-[10px] font-semibold text-gray-800 tabular-nums leading-tight"
                    />
                    <CertField
                        value={formatCertificateDateTime(completedAt)}
                        label="End Time"
                        valueClassName="text-[10px] font-semibold text-gray-800 tabular-nums leading-tight"
                    />
                </div>
            </div>
        </div>
    )
}

/** Ô thông tin — giá trị trên, gạch ngang, nhãn dưới (form chứng chỉ thật) */
function CertField({
    value,
    label,
    className = '',
    valueClassName = 'text-[12px] font-semibold text-gray-900',
}: {
    value: string
    label: string
    className?: string
    valueClassName?: string
}) {
    return (
        <div className={`flex flex-col justify-end px-2.5 py-2 h-full min-h-[48px] ${className}`}>
            <p className={`break-words leading-snug ${valueClassName}`}>{value}</p>
            <div className="border-t border-gray-800/60 mt-1.5 pt-1">
                <p className="text-[8px] md:text-[9px] text-gray-600 leading-tight">{label}</p>
            </div>
        </div>
    )
}



/** Thanh điểm — vòng tròn + mũi nhọn chỉ vị trí trên scale (giống chứng chỉ TOEIC) */
function ScoreBarRow({
    icon,
    label,
    score,
}: {
    icon: ReactNode
    label: string
    /** null = chưa làm section này trong phiên (partial test) */
    score: number | null
}) {
    const hasScore = score != null
    const markerLeft = hasScore ? scoreMarkerLeftPercent(score) : null

    return (
        <div className={cn('w-full', !hasScore && 'opacity-75')}>
            <div
                className={cn(
                    'inline-flex items-center gap-2 text-white text-[11px] font-bold px-3 py-1.5 rounded-sm shadow-sm',
                    hasScore ? 'bg-[#e85d04]' : 'bg-gray-400',
                )}
            >
                {icon}
                <span className="tracking-wide">{label}</span>
            </div>

            <p className="text-[10px] text-gray-700 mt-3 mb-1">
                {hasScore ? 'Your score' : 'Chưa thi phần này'}
            </p>
            <div className="relative h-[72px] w-full min-w-[240px] pl-1">
                {hasScore && markerLeft != null ? (
                    <div
                        className="absolute bottom-[16px] flex flex-col items-center -translate-x-1/2 z-[2]"
                        style={{ left: `${markerLeft}%` }}
                    >
                        <div className="w-[44px] h-[44px] rounded-full border-2 border-black bg-white flex items-center justify-center shadow-sm">
                            <span className="text-[15px] font-bold text-gray-900 tabular-nums leading-none">
                                {score}
                            </span>
                        </div>
                        <div
                            className="w-0 h-0"
                            style={{
                                borderLeft: '7px solid transparent',
                                borderRight: '7px solid transparent',
                                borderTop: '9px solid #111827',
                            }}
                        />
                    </div>
                ) : (
                    <div className="absolute bottom-[16px] left-1/2 flex flex-col items-center -translate-x-1/2 z-[2]">
                        <div className="w-[44px] h-[44px] rounded-full border-2 border-dashed border-gray-400 bg-gray-50 flex items-center justify-center">
                            <span className="text-lg font-bold text-gray-400 leading-none">—</span>
                        </div>
                    </div>
                )}

                <div
                    className={cn(
                        'absolute bottom-0 left-0 right-0 h-[14px] rounded-[2px] shadow-inner',
                        hasScore
                            ? 'bg-gradient-to-r from-gray-200 via-gray-600 to-gray-900'
                            : 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300',
                    )}
                />
                <div className="absolute -bottom-4 left-0 right-0 flex justify-between text-[10px] text-gray-500 font-medium">
                    <span>5</span>
                    <span>495</span>
                </div>
            </div>
        </div>
    )
}


