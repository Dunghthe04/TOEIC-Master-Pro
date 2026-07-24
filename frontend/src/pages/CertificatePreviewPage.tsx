/**
 * Trang xem trước chứng chỉ SAMPLE — không cần làm bài / nộp bài.
 * Dùng để kiểm tra layout trước khi tích hợp vào luồng thi.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ToeicSampleCertificate from '@/components/exam/ToeicSampleCertificate'
import { useAuthStore } from '@/store/auth.store'
import { toast } from 'sonner'

/** Dữ liệu mẫu cố định cho preview */
const SAMPLE = {
    testSeries: 'ETS2026',
    testTitle: 'Test 01',
    startedAt: '2026-07-24T14:30:15.000Z',
    completedAt: '2026-07-24T16:15:42.000Z',
    listeningScore: 265,
    readingScore: 305,
    totalScore: 570,
}

export default function CertificatePreviewPage() {
    const user = useAuthStore((s) => s.user)

    return (
        <div className="min-h-screen bg-[#eef2f6]">
            <header className="bg-[#1a4d7c] text-white px-4 md:px-8 py-3 flex items-center justify-between">
                <span className="font-semibold">TOEIC MASTER — Xem trước chứng chỉ SAMPLE</span>
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/mock-test">
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Danh sách đề
                    </Link>
                </Button>
            </header>

            <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-8">
                <p className="text-sm text-muted-foreground">
                    Đây là bản xem trước. Sau khi <strong>Nộp bài</strong> trong màn thi, chứng chỉ
                    tương tự sẽ hiện với tên và điểm thật của bạn.
                </p>

                {/* Chứng chỉ React — giống màn sau Nộp bài */}
                <section className="space-y-2">
                    <h2 className="font-semibold text-base">Chứng chỉ SAMPLE</h2>
                    <p className="text-xs text-muted-foreground">
                        Ảnh, tên, bộ đề, bài thi, Start/End Time, điểm — không có Session ID.
                    </p>
                    <ToeicSampleCertificate
                        fullName={user?.fullName ?? 'Nguyễn Văn A'}
                        avatarUrl={user?.avatarUrl}
                        testSeries={SAMPLE.testSeries}
                        testTitle={SAMPLE.testTitle}
                        startedAt={SAMPLE.startedAt}
                        completedAt={SAMPLE.completedAt}
                        listeningScore={SAMPLE.listeningScore}
                        readingScore={SAMPLE.readingScore}
                        totalScore={SAMPLE.totalScore}
                        onViewDetails={() =>
                            toast.message('Nút này hoạt động sau khi Nộp bài thật.')
                        }
                    />
                </section>
            </main>
        </div>
    )
}
