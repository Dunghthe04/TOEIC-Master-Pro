/**
 * Trang chủ ContentManager — /cm.
 *
 * CM chỉ lo nội dung: số đề, số câu hỏi, đề nào thiếu audio. KHÔNG có thống kê
 * hệ thống (user, lượt thi) — đó là việc của Admin, tách nhiệm vụ rõ ràng.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, HelpCircle, Upload, AlertTriangle } from 'lucide-react'
import { TestService } from '@/services/test.service'
import { QuestionService } from '@/services/question.service'
import type { TestSummary } from '@/types/test.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function CmHomePage() {
    const [tests, setTests] = useState<TestSummary[]>([])
    const [questionCount, setQuestionCount] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            TestService.getList(),
            QuestionService.getList(),
        ])
            .then(([t, q]) => {
                setTests(t)
                setQuestionCount(q.length)
            })
            .finally(() => setLoading(false))
    }, [])

    const published = tests.filter(t => t.isPublished).length
    const draft = tests.length - published
    // Đề có questionCount = 0 là dấu hiệu CM quên gán câu hỏi — cảnh báo để không sót
    const missingQuestions = tests.filter(t => t.questionCount === 0)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Trang chủ quản lý nội dung</h1>
                <p className="mt-1 text-sm text-gray-500">Tổng quan đề thi và câu hỏi bạn phụ trách.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <StatCard icon={FileText} label="Tổng số đề" value={loading ? '…' : tests.length} />
                <StatCard icon={FileText} label="Đề đã publish" value={loading ? '…' : published} sub={`${draft} nháp`} />
                <StatCard icon={HelpCircle} label="Câu hỏi trong kho" value={loading ? '…' : questionCount ?? 0} />
            </div>

            {!loading && missingQuestions.length > 0 && (
                <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="flex items-start gap-3 pt-6">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                        <div>
                            <p className="text-sm font-medium text-amber-900">
                                {missingQuestions.length} đề chưa có câu hỏi nào
                            </p>
                            <p className="mt-1 text-sm text-amber-700">
                                {missingQuestions.map(t => t.title).join(', ')}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <QuickLink to="/cm/tests/create" icon={FileText} label="Tạo đề mới" />
                <QuickLink to="/cm/questions/import" icon={Upload} label="Import câu hỏi" />
                <QuickLink to="/cm/questions" icon={HelpCircle} label="Quản lý câu hỏi" />
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof FileText; label: string; value: string | number; sub?: string }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">{label}</CardTitle>
                <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
            </CardContent>
        </Card>
    )
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof FileText; label: string }) {
    return (
        <Link
            to={to}
            className="flex items-center gap-3 rounded-lg border bg-white p-4 transition-colors hover:bg-gray-50"
        >
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Icon size={20} />
            </span>
            <span className="font-medium text-gray-900">{label}</span>
        </Link>
    )
}
