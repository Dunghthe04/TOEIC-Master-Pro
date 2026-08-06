/**
 * Trang chủ Admin — /admin. Chỉ XEM, không CRUD nội dung (đó là việc của CM).
 * Quản lý tài khoản (gán role, khóa/mở) là Day 37 — chưa làm, xem AdminController.
 */
import { useEffect, useState } from 'react'
import { Users, FileText, HelpCircle, ClipboardCheck, TrendingUp, Trophy } from 'lucide-react'
import { AdminService } from '@/services/admin.service'
import type { AdminOverview } from '@/types/admin.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminOverviewPage() {
    const [data, setData] = useState<AdminOverview | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        AdminService.getOverview()
            .then(setData)
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
                <p className="mt-1 text-sm text-gray-500">Số liệu toàn hệ thống — chỉ xem, không chỉnh sửa nội dung.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard icon={Users} label="Tổng người dùng" value={loading ? '…' : data?.users.total ?? 0}
                    sub={loading ? undefined : `+${data?.users.new7Days} trong 7 ngày`} />
                <StatCard icon={FileText} label="Tổng đề thi" value={loading ? '…' : data?.content.totalTests ?? 0}
                    sub={loading ? undefined : `${data?.content.publishedTests} published`} />
                <StatCard icon={HelpCircle} label="Tổng câu hỏi" value={loading ? '…' : data?.content.totalQuestions ?? 0} />
                <StatCard icon={ClipboardCheck} label="Lượt thi đã hoàn thành" value={loading ? '…' : data?.exams.totalSessions ?? 0}
                    sub={loading ? undefined : `+${data?.exams.sessions7Days} trong 7 ngày`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <CardTitle className="text-sm font-medium text-gray-500">Điểm trung bình toàn hệ thống</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-blue-600">
                            {loading ? '…' : data?.exams.averageScore ?? 0}
                            <span className="ml-1 text-sm font-normal text-gray-400">/ 990</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                        <Trophy className="h-4 w-4 text-gray-400" />
                        <CardTitle className="text-sm font-medium text-gray-500">Top 5 đề được làm nhiều nhất</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <p className="text-sm text-gray-400">Đang tải…</p>
                        ) : !data?.topTests.length ? (
                            <p className="text-sm text-gray-400">Chưa có lượt thi nào.</p>
                        ) : (
                            <ol className="space-y-2">
                                {data.topTests.map((t, i) => (
                                    <li key={t.testId} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-700">
                                            <span className="mr-2 text-gray-400">{i + 1}.</span>{t.title}
                                        </span>
                                        <span className="font-medium text-gray-900">{t.attempts} lượt</span>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) {
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
