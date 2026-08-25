/**
 * Màn kết quả sau nộp bài:
 *   1. Chứng chỉ SAMPLE + phân tích Part
 *   2. Panel review từng câu / đáp án
 */
import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import ExamShell from '@/components/layout/ExamShell'
import ToeicSampleCertificate from '@/components/exam/ToeicSampleCertificate'
import ExamPartBreakdownPanel from '@/components/exam/ExamPartBreakdownPanel'
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
    /** Nhãn nút quay danh sách — mặc định "Danh sách đề" */
    backListLabel?: string
}

export default function ExamResultScreen({
    title,
    testSeries,
    result,
    startedAt,
    questions,
    onBackStructure,
    onBackList,
    backListLabel = 'Danh sách đề',
}: ExamResultScreenProps) {
    const user = useAuthStore((s) => s.user)
    const [view, setView] = useState<ResultView>('certificate')

    return (
        <ExamShell
            title={title}
            partLabel={view === 'certificate' ? 'Kết quả bài thi' : 'Chi tiết đáp án'}
            /**
             * Màn CHI TIẾT dùng khung rộng, màn CHỨNG CHỈ thì không.
             *
             * Hai màn có nhu cầu ngược nhau nên không thể dùng chung một bề ngang:
             *   chứng chỉ  — là một tờ giấy, kéo rộng ra thì mất dáng văn bản.
             *   chi tiết   — hai cột, cột trái là ẢNH BÀI ĐỌC Part 7 quét từ giấy. Khung
             *                max-w-6xl (1152px) chia đôi còn ~540px mỗi cột, mà ảnh gốc
             *                rộng ~1245px → phải thu về 0.43 lần, chữ trong ảnh nhỏ đến
             *                mức phải nheo mắt. Khung `wide` cho 1600px → ~0.69 lần, xấp
             *                xỉ đúng cỡ lúc đang thi.
             */
            wide={view === 'details'}
            answeredCount={result.correctCount}
            totalCount={result.totalCount}
            footer={
                <div className="flex w-full justify-between gap-2">
                    {/* Ở màn chi tiết, nút trái là "Quay lại chứng chỉ".
                        Trước đây nút này nằm trên một thanh dính riêng ở đầu vùng nội dung —
                        thanh đó chiếm nguyên một hàng suốt cả trang chỉ để chứa nó và bốn
                        con số bộ lọc. Thanh chân đã có sẵn và luôn hiện, mà mọi nút điều
                        hướng khác của màn này vốn đã ở đây; thêm một nút thì không tốn thêm
                        một milimet chiều cao nào. */}
                    {view === 'details' ? (
                        <Button variant="outline" onClick={() => setView('certificate')}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Quay lại chứng chỉ
                        </Button>
                    ) : (
                        <Button variant="outline" onClick={onBackStructure}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Về cấu trúc đề
                        </Button>
                    )}
                    <Button variant="outline" onClick={onBackList}>
                        {backListLabel}
                    </Button>
                </div>
            }
        >
            {view === 'certificate' ? (
                <div className="w-full">
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
                    <ExamPartBreakdownPanel items={result.partBreakdown ?? []} />
                </div>
            ) : (
                <ExamAnswerReviewPanel reviews={result.reviews} questions={questions} />
            )}
        </ExamShell>
    )
}
