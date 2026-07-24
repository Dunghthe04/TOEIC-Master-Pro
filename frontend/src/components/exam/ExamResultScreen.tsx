/**
 * Màn kết quả sau nộp bài:
 *   1. Chứng chỉ SAMPLE + nút xem chi tiết
 *   2. Panel review từng câu / đáp án
 */
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import ExamShell from '@/components/layout/ExamShell'
import ToeicSampleCertificate from '@/components/exam/ToeicSampleCertificate'
import ExamAnswerReviewPanel from '@/components/exam/ExamAnswerReviewPanel'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import type { PlayQuestion } from '@/types/test.types'
import type { TestSessionSubmitResult } from '@/types/test-session.types'

type ResultView = 'certificate' | 'details'

type ExamResultScreenProps = {
    title: string
    testSeries: string
    result: TestSessionSubmitResult
    startedAt: string
    questions: PlayQuestion[]
    onBackStructure: () => void
    onBackList: () => void
}

export default function ExamResultScreen({
    title,
    testSeries,
    result,
    startedAt,
    questions,
    onBackStructure,
    onBackList,
}: ExamResultScreenProps) {
    const user = useAuthStore((s) => s.user)
    const [view, setView] = useState<ResultView>('certificate')

    return (
        <ExamShell
            title={title}
            partLabel={view === 'certificate' ? 'Kết quả bài thi' : 'Chi tiết đáp án'}
            answeredCount={result.correctCount}
            totalCount={result.totalCount}
            footer={
                <div className="flex w-full justify-between gap-2">
                    <Button variant="outline" onClick={onBackStructure}>
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Về cấu trúc đề
                    </Button>
                    <Button variant="outline" onClick={onBackList}>
                        Danh sách đề
                    </Button>
                </div>
            }
        >
            {view === 'certificate' ? (
                <ToeicSampleCertificate
                    fullName={user?.fullName ?? 'Thí sinh'}
                    avatarUrl={user?.avatarUrl}
                    testSeries={testSeries}
                    testTitle={title}
                    startedAt={startedAt}
                    completedAt={result.completedAt}
                    listeningScore={result.listeningScore}
                    readingScore={result.readingScore}
                    totalScore={result.totalScore}
                    onViewDetails={() => setView('details')}
                />
            ) : (
                <ExamAnswerReviewPanel
                    reviews={result.reviews}
                    questions={questions}
                    onBack={() => setView('certificate')}
                />
            )}
        </ExamShell>
    )
}
