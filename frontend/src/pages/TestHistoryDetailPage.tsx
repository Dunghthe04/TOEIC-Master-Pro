/**
 * Xem lại kết quả 1 lần thi từ lịch sử — Day 31 Bước 5.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TestSessionService } from '@/services/test-session.service'
import { TestService } from '@/services/test.service'
import { sessionDetailToSubmitResult } from '@/types/test-session.types'
import type { TestSessionDetailResponse } from '@/types/test-session.types'
import type { TestPlay } from '@/types/test.types'
import ExamResultScreen from '@/components/exam/ExamResultScreen'
import ExamShell from '@/components/layout/ExamShell'
import { toast } from 'sonner'

export default function TestHistoryDetailPage() {
    const { sessionId } = useParams<{ sessionId: string }>()
    const navigate = useNavigate()

    const [detail, setDetail] = useState<TestSessionDetailResponse | null>(null)
    const [play, setPlay] = useState<TestPlay | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!sessionId) return
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const sessionDetail = await TestSessionService.getDetail(sessionId)
                if (cancelled) return
                setDetail(sessionDetail)

                const playData = await TestService.getPlay(
                    sessionDetail.testId,
                    sessionDetail.partsFilter ?? undefined
                )
                if (cancelled) return
                setPlay(playData)
            } catch {
                toast.error('Không tải được kết quả lần thi này.')
                navigate('/mock-test/history')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [sessionId, navigate])

    if (loading) {
        return (
            <ExamShell
                title="Lịch sử thi"
                partLabel="Đang tải…"
                answeredCount={0}
                totalCount={0}
            >
                <p className="text-sm text-muted-foreground text-center py-12">
                    Đang tải kết quả…
                </p>
            </ExamShell>
        )
    }

    if (!detail || !play) return null

    const historyListUrl = `/mock-test/history?testId=${detail.testId}`

    return (
        <ExamResultScreen
            title={detail.testTitle}
            testSeries={detail.testSeries}
            result={sessionDetailToSubmitResult(detail)}
            startedAt={detail.startedAt}
            questions={play.questions}
            onBackStructure={() => navigate(`/mock-test/${detail.testId}`)}
            onBackList={() => navigate(historyListUrl)}
            backListLabel="Lịch sử thi"
        />
    )
}
