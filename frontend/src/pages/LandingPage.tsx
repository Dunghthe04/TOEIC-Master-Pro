/**
 * Landing page — trang mặc định khi vào "/", KHÔNG bắt đăng nhập.
 *
 * VÌ SAO: trước đây "/" đẩy thẳng sang /login — khách vãng lai không biết web làm được gì.
 * Giống các trang luyện thi TOEIC thật: xem được có những đề nào, tính năng gì, rồi mới
 * đăng ký. Bấm vào chức năng cần đăng nhập → hiện POPUP, không rời trang.
 *
 * Dữ liệu thật lấy từ 2 endpoint [AllowAnonymous]:
 *   GET /api/test/published   — danh sách đề (metadata, KHÔNG có câu hỏi/đáp án)
 *   GET /api/examschedule     — lịch thi TOEIC
 */
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowRight, Award, BarChart3, Bell, BookMarked, CalendarDays, CheckCircle2,
    ClipboardList, FileText, Headphones, MapPin, Target, Timer, TrendingUp, Zap,
} from 'lucide-react'
import {
    CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TestService } from '@/services/test.service'
import type { TestSummary } from '@/types/test.types'
import { ExamScheduleService } from '@/services/exam-schedule.service'
import type { ExamSchedule } from '@/types/exam-schedule.types'
import ToeicSampleCertificate from '@/components/exam/ToeicSampleCertificate'
import { useAuthStore } from '@/store/auth.store'
import { homeFor } from '@/lib/roles'
import AuthDialog from '@/components/auth/AuthDialog'
import { useInView } from '@/hooks/useInView'

/** Sáu tính năng — mô tả ĐÚNG những gì hệ thống làm được, không hứa thêm. */
const FEATURES = [
    {
        icon: ClipboardList,
        title: 'Thi thử full test 2 tiếng',
        desc: 'Đề 200 câu đầy đủ 7 Part, audio Listening phát tự động, đồng hồ đếm ngược như thi thật.',
    },
    {
        icon: Award,
        title: 'Chấm điểm quy đổi ETS',
        desc: 'Điểm Listening / Reading quy đổi theo bảng ETS chính thức, không phải nhân hệ số ước lệ.',
    },
    {
        icon: BarChart3,
        title: 'Phân tích từng Part',
        desc: 'Biết chính xác Part nào yếu, đúng bao nhiêu câu trên tổng — để biết cần ôn gì.',
    },
    {
        icon: TrendingUp,
        title: 'Biểu đồ tiến độ',
        desc: 'Điểm theo thời gian, best score từng đề, khoảng cách còn lại tới mục tiêu của bạn.',
    },
    {
        icon: FileText,
        title: 'Chứng chỉ mô phỏng',
        desc: 'Xem kết quả dưới dạng phiếu điểm giống mẫu TOEIC thật — tải về hoặc chụp lại.',
    },
    {
        icon: BookMarked,
        title: 'Từ vựng theo SRS',
        desc: 'Flashcard lặp lại giãn cách (SM-2) — ôn đúng lúc sắp quên, không học lại thứ đã nhớ.',
    },
]

const STEPS = [
    { n: 1, title: 'Chọn đề', desc: 'Thi full test hoặc chỉ luyện vài Part bạn muốn.' },
    { n: 2, title: 'Làm bài', desc: 'Audio tự phát, đáp án tự lưu — mất mạng không mất bài.' },
    { n: 3, title: 'Xem kết quả', desc: 'Điểm ETS, Part yếu, xem lại từng câu kèm giải thích.' },
]

/**
 * Menu header của landing — trỏ tới CHỨC NĂNG THẬT trong app, không phải anchor cuộn trang.
 * Khách bấm vào thấy ngay web làm được gì và đi tới đâu.
 *
 * requireLogin = true  → bấm ra popup login, xong vào đúng route đó (returnTo)
 * requireLogin = false → vào được ngay vì backend đã [AllowAnonymous]
 */
// export: PublicGuestHeader.tsx (header cho khách ở /exam-schedule, /mock-test/:id)
// dùng lại đúng danh sách này, tránh 2 nơi giữ 2 bản nav lệch nhau.
export const LANDING_NAV: { label: string; to: string; requireLogin: boolean }[] = [
    { label: 'Thi thử', to: '/mock-test', requireLogin: true },
    { label: 'Luyện nhanh', to: '/practice', requireLogin: true },
    { label: 'Từ vựng', to: '/vocabulary', requireLogin: true },
    { label: 'Tiến độ', to: '/mock-test/progress', requireLogin: true },
    // Lịch thi TOEIC là thông tin công khai — GET /api/examschedule đã [AllowAnonymous]
    { label: 'Lịch thi', to: '/exam-schedule', requireLogin: false },
]

/**
 * Dữ liệu MẪU cho biểu đồ minh họa — không phải số liệu thật của ai.
 * Landing cho khách vãng lai xem nên không thể dùng dữ liệu user; đây là ảnh chụp
 * "sản phẩm trông như thế nào", cùng vai với ảnh phiếu điểm ở hero.
 */
const DEMO_PROGRESS = [
    { label: 'Lần 1', score: 520 },
    { label: 'Lần 2', score: 585 },
    { label: 'Lần 3', score: 610 },
    { label: 'Lần 4', score: 655 },
    { label: 'Lần 5', score: 700 },
    { label: 'Lần 6', score: 745 },
]

/** Part yếu — minh họa cho tính năng phân tích theo Part */
const DEMO_PARTS = [
    { part: 'Part 1', correct: 5, total: 6 },
    { part: 'Part 2', correct: 21, total: 25 },
    { part: 'Part 3', correct: 28, total: 39 },
    { part: 'Part 5', correct: 24, total: 30 },
    { part: 'Part 7', correct: 32, total: 54 },
]

export default function LandingPage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { user, isAuthenticated } = useAuthStore()

    const [tests, setTests] = useState<TestSummary[]>([])
    const [loadingTests, setLoadingTests] = useState(true)
    const [schedules, setSchedules] = useState<ExamSchedule[]>([])

    /** Đích đến sau khi đăng nhập xong — null = popup đang đóng */
    const [authTarget, setAuthTarget] = useState<string | null>(null)

    // Đã đăng nhập mà vào "/" thì đưa về trang chủ theo vai — không xem landing nữa
    useEffect(() => {
        if (isAuthenticated && user) navigate(homeFor(user), { replace: true })
    }, [isAuthenticated, user, navigate])

    // Khách bấm mục cần login trên PublicGuestHeader (VD khi đang ở /exam-schedule)
    // → được đưa về "/?next=/mock-test" → tự mở đúng popup login nhắm tới route đó,
    // thay vì phải tự nhớ bấm lại mục đó lần nữa sau khi vào landing page.
    useEffect(() => {
        const next = searchParams.get('next')
        if (next) setAuthTarget(next)
    }, [searchParams])

    useEffect(() => {
        TestService.getPublished()
            .then(setTests)
            .catch(() => setTests([]))       // endpoint lỗi thì ẩn section, không làm sập trang
            .finally(() => setLoadingTests(false))

        // Lịch thi TOEIC — endpoint [AllowAnonymous] từ trước, giờ mới có chỗ dùng.
        // Chỉ lấy kỳ thi còn hiệu lực, sắp xếp theo ngày gần nhất.
        ExamScheduleService.getList({ isActive: true })
            .then(list =>
                setSchedules(
                    [...list]
                        .filter(s => new Date(s.examDate) >= new Date())
                        .sort((a, b) => +new Date(a.examDate) - +new Date(b.examDate))
                        .slice(0, 3)
                )
            )
            .catch(() => setSchedules([]))
    }, [])

    /** Mở popup đăng nhập, ghi nhớ nơi cần tới sau khi xong */
    const requireAuth = (target: string) => setAuthTarget(target)

    return (
        // scroll-smooth: anchor link (#features, #tests) cuộn mượt thay vì nhảy giật.
        // scroll-mt-16 ở section bù chiều cao header sticky, không thì tiêu đề bị header che.
        <div className="min-h-screen scroll-smooth bg-white [&_section]:scroll-mt-16">
            {/* ── Header ───────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-blue-600 text-white shadow-sm">
                <div className="flex h-16 items-center gap-4 px-6">
                    <Link to="/" className="flex shrink-0 items-center gap-2 font-bold">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-blue-600">T</span>
                        <span className="text-lg">TOEIC Master</span>
                    </Link>

                    {/* Spacer đầu: cùng cặp với flex-1 sau menu (dòng dưới) để "ép" nav vào
                        chính giữa header, không phụ thuộc độ rộng logo hay nhóm nút bên phải. */}
                    <div className="hidden flex-1 lg:block" />

                    {/* Menu CHỨC NĂNG thật — trỏ tới route trong app, không phải anchor cuộn trang.
                        Khách bấm vào → popup login, đăng nhập xong vào đúng chức năng đó (returnTo).
                        Trừ "Lịch thi": endpoint [AllowAnonymous] nên xem được ngay, không cần login. */}
                    <nav className="hidden items-center gap-1 lg:flex">
                        {LANDING_NAV.map(({ label, to, requireLogin }) =>
                            requireLogin ? (
                                <button
                                    key={label}
                                    onClick={() => requireAuth(to)}
                                    className="rounded-md px-3 py-2 text-sm font-medium text-blue-50
                                               transition-colors hover:bg-blue-700"
                                >
                                    {label}
                                </button>
                            ) : (
                                <Link
                                    key={label}
                                    to={to}
                                    className="rounded-md px-3 py-2 text-sm font-medium text-blue-50
                                               transition-colors hover:bg-blue-700"
                                >
                                    {label}
                                </Link>
                            )
                        )}
                    </nav>

                    <div className="flex-1" />

                    <button
                        onClick={() => requireAuth('/dashboard')}
                        className="rounded-md px-3 py-2 text-sm font-medium text-blue-50 hover:bg-blue-700"
                    >
                        Đăng nhập
                    </button>
                    <button
                        onClick={() => requireAuth('/mock-test')}
                        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-bold uppercase tracking-wide
                                   shadow transition-colors hover:bg-orange-600"
                    >
                        Thi thử ngay
                    </button>
                </div>
            </header>

            {/* ── Hero ─────────────────────────────────────────────── */}
            <section className="bg-gradient-to-b from-blue-600 to-blue-700 text-white">
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
                    {/* Hero hiện ngay khi vào trang (không chờ cuộn) — animate-in của tw-animate-css */}
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                            Luyện thi TOEIC với đề thật,<br />
                            <span className="text-orange-300">chấm điểm chuẩn ETS</span>
                        </h1>
                        <p className="mt-5 max-w-lg text-base text-blue-100 sm:text-lg">
                            Thi thử full test 2 tiếng, biết ngay điểm quy đổi và Part nào mình yếu.
                            Miễn phí, không cần thẻ.
                        </p>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <button
                                onClick={() => requireAuth('/mock-test')}
                                className="group flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3.5 font-bold
                                           shadow-lg shadow-orange-900/20 transition-all duration-300
                                           hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-xl"
                            >
                                Thi thử miễn phí
                                {/* Mũi tên nhích sang phải khi hover — gợi ý "đi tiếp" */}
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </button>
                            <a
                                href="#tests"
                                className="rounded-lg border-2 border-white/40 px-6 py-3.5 font-semibold
                                           transition-all duration-300 hover:border-white/70 hover:bg-white/10"
                            >
                                Xem đề có sẵn
                            </a>
                        </div>

                        <ul className="mt-8 space-y-2 text-sm text-blue-100">
                            {['Đề 200 câu đủ 7 Part', 'Điểm quy đổi theo bảng ETS', 'Phân tích Part yếu sau mỗi lần thi'].map(t => (
                                <li key={t} className="flex items-center gap-2">
                                    <CheckCircle2 size={16} className="shrink-0 text-orange-300" /> {t}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Ảnh minh họa "phiếu điểm" — dựng bằng CSS, không cần file ảnh.
                        Vào sau tiêu đề 200ms cho có nhịp, và nhấc nhẹ lên khi hover. */}
                    <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/20 backdrop-blur
                                    animate-in fade-in slide-in-from-bottom-6 delay-200 duration-700
                                    transition-transform hover:-translate-y-1">
                        <div className="rounded-xl bg-white p-6 text-gray-800 shadow-xl">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Kết quả thi thử
                            </p>
                            <div className="mt-3 flex items-end gap-2">
                                <span className="text-5xl font-extrabold text-blue-600">745</span>
                                <span className="pb-2 text-sm text-gray-500">/ 990</span>
                            </div>
                            <div className="mt-5 space-y-3">
                                <ScoreBar label="Listening" score={395} icon={Headphones} />
                                <ScoreBar label="Reading" score={350} icon={FileText} />
                            </div>
                            <div className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                                <span className="font-semibold">Part yếu nhất:</span> Part 7 — đúng 32/54 câu
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Tính năng ────────────────────────────────────────── */}
            <section id="features" className="mx-auto max-w-6xl px-6 py-20">
                <Reveal>
                    <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                        Hệ thống làm được gì
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
                        Sáu tính năng chính — mô tả đúng những gì đang chạy, không hứa thêm.
                    </p>
                </Reveal>

                <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                        // delay tăng dần theo index → 6 thẻ vào lần lượt, không bật cùng lúc
                        <Reveal key={title} delay={i * 80}>
                            <div className="group h-full rounded-xl border bg-white p-6 transition-all duration-300
                                            hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                                <span className="grid h-11 w-11 place-items-center rounded-lg bg-blue-50 text-blue-600
                                                 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                    <Icon size={22} />
                                </span>
                                <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
                                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── Đề thi có sẵn (dữ liệu THẬT từ API) ──────────────── */}
            <section id="tests" className="bg-gray-50 py-16">
                <div className="mx-auto max-w-6xl px-6">
                    <Reveal>
                        <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                            Đề thi có sẵn
                        </h2>
                        <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
                            Xem trước cấu trúc đề. Bấm "Bắt đầu thi" cần đăng nhập để lưu kết quả.
                        </p>
                    </Reveal>

                    {loadingTests ? (
                        <p className="mt-10 text-center text-sm text-gray-500">Đang tải danh sách đề…</p>
                    ) : tests.length === 0 ? (
                        <p className="mt-10 text-center text-sm text-gray-500">
                            Chưa có đề nào được publish.
                        </p>
                    ) : (
                        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {tests.slice(0, 6).map((t, i) => (
                                <Reveal key={t.id} delay={i * 80} className="flex">
                                <div className="flex flex-1 flex-col rounded-xl border bg-white p-6
                                                transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                                    {t.series && (
                                        <span className="w-fit rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                                            {t.series}
                                        </span>
                                    )}
                                    <h3 className="mt-3 font-semibold text-gray-900">{t.title}</h3>
                                    {t.description && (
                                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{t.description}</p>
                                    )}

                                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
                                        <span className="flex items-center gap-1.5">
                                            <ClipboardList size={15} /> {t.questionCount} câu
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Timer size={15} /> {t.durationMinutes} phút
                                        </span>
                                    </div>

                                    <div className="mt-5 flex flex-1 items-end gap-2">
                                        {/* Xem cấu trúc: endpoint [AllowAnonymous] nên khách vào được */}
                                        <Link
                                            to={`/mock-test/${t.id}`}
                                            className="flex-1 rounded-md border px-3 py-2 text-center text-sm font-medium
                                                       text-gray-700 transition-colors hover:bg-gray-50"
                                        >
                                            Xem cấu trúc
                                        </Link>
                                        {/* Bắt đầu thi: cần lưu phiên trên server → phải đăng nhập */}
                                        <button
                                            onClick={() => requireAuth(`/mock-test/${t.id}`)}
                                            className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold
                                                       text-white transition-colors hover:bg-blue-700"
                                        >
                                            Bắt đầu thi
                                        </button>
                                    </div>
                                </div>
                                </Reveal>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Chứng chỉ mô phỏng ───────────────────────────────── */}
            <section id="certificate" className="bg-gray-50 py-20">
                <div className="mx-auto max-w-6xl px-6">
                    <Reveal>
                        <div className="text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1
                                             text-xs font-semibold text-amber-700">
                                <Award size={14} /> Sau mỗi lần thi
                            </span>
                            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
                                Phiếu điểm giống mẫu TOEIC thật
                            </h2>
                            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
                                Không chỉ là một con số. Điểm Listening / Reading quy đổi ETS,
                                thang 5–495, kèm mô tả trình độ — trình bày đúng như phiếu điểm thật.
                            </p>
                        </div>
                    </Reveal>

                    {/* Dùng CHÍNH component chứng chỉ của app (ToeicSampleCertificate), không dựng
                        lại bằng CSS — khách xem landing thấy đúng thứ mình sẽ nhận sau khi thi.
                        Dữ liệu là mẫu; watermark SAMPLE đã có sẵn trong component. */}
                    <Reveal delay={100}>
                        <div className="mt-12 [&_button]:hidden">
                            <ToeicSampleCertificate
                                fullName="NGUYEN VAN A"
                                avatarUrl={null}
                                testSeries="ETS2026"
                                testTitle="Test 01"
                                startedAt="2026-08-01T08:30:00"
                                completedAt="2026-08-01T10:30:00"
                                listeningScore={395}
                                readingScore={350}
                                totalScore={745}
                            />
                        </div>
                    </Reveal>

                    <Reveal delay={200}>
                        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
                            {[
                                'Điểm từng section theo thang 5–495',
                                'Mô tả trình độ theo mức điểm',
                                'Xem lại từng câu kèm giải thích đáp án',
                                'Tải về dạng ảnh PNG để lưu tiến bộ',
                            ].map(t => (
                                <div key={t} className="flex items-start gap-2.5 text-sm text-gray-700">
                                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" /> {t}
                                </div>
                            ))}
                        </div>
                        <p className="mt-6 text-center text-xs text-gray-400">
                            Phiếu điểm mô phỏng để tự theo dõi — không phải chứng chỉ TOEIC do ETS cấp.
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ── Biểu đồ tiến độ ──────────────────────────────────── */}
            {/* Nền TRẮNG — section chứng chỉ phía trên đã dùng gray-50, xen kẽ cho phân tách rõ */}
            <section id="progress" className="py-20">
                <div className="mx-auto max-w-6xl px-6">
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        {/* Biểu đồ đặt TRƯỚC text trên desktop (order-1) để xen kẽ với section trên */}
                        <Reveal className="lg:order-1">
                            <div className="rounded-2xl border bg-white p-6 shadow-lg">
                                <p className="font-semibold text-gray-900">Điểm theo thời gian</p>
                                <p className="mt-0.5 text-xs text-gray-500">
                                    Mỗi điểm = một lần thi · đường đỏ = mục tiêu bạn đặt
                                </p>
                                <div className="mt-4 h-56">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={DEMO_PROGRESS} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                            <YAxis domain={[400, 990]} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                                            <Tooltip
                                                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                                                formatter={(v) => [`${v} điểm`, 'Tổng']}
                                            />
                                            {/* Mục tiêu 800 — app vẽ đường này theo targetScore trong profile */}
                                            <ReferenceLine y={800} stroke="#ef4444" strokeDasharray="4 4"
                                                label={{ value: 'Mục tiêu 800', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }} />
                                            <Line
                                                type="monotone" dataKey="score"
                                                stroke="#2f7fc4" strokeWidth={2.5}
                                                dot={{ r: 4, fill: '#2f7fc4' }}
                                                activeDot={{ r: 6 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Độ chính xác từng Part — gom nhiều lần thi lại.
                                    Thanh ĐỎ khi dưới 60%: đây chính là cách app chỉ ra "Part yếu". */}
                                <div className="mt-6 border-t pt-5">
                                    <p className="text-sm font-semibold text-gray-900">Độ chính xác từng Part</p>
                                    <div className="mt-3 space-y-2">
                                        {DEMO_PARTS.map(p => {
                                            const pct = Math.round((p.correct / p.total) * 100)
                                            return (
                                                <div key={p.part} className="flex items-center gap-3 text-xs">
                                                    <span className="w-14 shrink-0 text-gray-500">{p.part}</span>
                                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-1000
                                                                ${pct < 60 ? 'bg-red-400' : 'bg-green-500'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-14 shrink-0 text-right font-medium text-gray-700">
                                                        {p.correct}/{p.total}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <p className="mt-3 text-xs text-amber-700">
                                        Part 7 dưới 60% → app xếp vào <strong>Part yếu nhất</strong>, ưu tiên ôn trước.
                                    </p>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={120}>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1
                                             text-xs font-semibold text-blue-700">
                                <TrendingUp size={14} /> Theo dõi tiến bộ
                            </span>
                            <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
                                Thấy rõ mình đang tiến hay đứng
                            </h2>
                            <p className="mt-4 leading-relaxed text-gray-600">
                                Mỗi lần thi là một điểm trên biểu đồ. Nhìn một lần là biết đang tăng
                                đều, đứng yên, hay tụt — và còn cách mục tiêu bao nhiêu điểm.
                            </p>
                            <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                {[
                                    { icon: TrendingUp, title: 'Đường tiến độ', desc: 'Điểm theo từng lần thi' },
                                    { icon: Target, title: 'Khoảng cách mục tiêu', desc: 'Còn bao nhiêu điểm nữa' },
                                    { icon: BarChart3, title: 'Độ chính xác từng Part', desc: 'Gom nhiều lần thi lại' },
                                    { icon: Award, title: 'Best score mỗi đề', desc: 'Điểm cao nhất từng đề' },
                                ].map(({ icon: Icon, title, desc }) => (
                                    <div key={title} className="flex gap-3">
                                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white
                                                         text-blue-600 shadow-sm">
                                            <Icon size={17} />
                                        </span>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-900">{title}</p>
                                            <p className="text-xs text-gray-500">{desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── Lịch thi TOEIC + nhắc email (dữ liệu THẬT) ───────── */}
            <section id="schedule" className="mx-auto max-w-6xl px-6 py-20">
                <Reveal>
                    <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1
                                         text-xs font-semibold text-green-700">
                            <Bell size={14} /> Không bỏ lỡ hạn đăng ký
                        </span>
                        <h2 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">
                            Lịch thi TOEIC &amp; nhắc email tự động
                        </h2>
                        <p className="mx-auto mt-3 max-w-2xl text-gray-600">
                            Bấm chuông ở kỳ thi bạn quan tâm — hệ thống gửi email nhắc{' '}
                            <strong>trước 3 ngày</strong>. Thêm được vào Google Calendar bằng file .ics.
                        </p>
                    </div>
                </Reveal>

                {schedules.length === 0 ? (
                    <Reveal>
                        <p className="mt-10 text-center text-sm text-gray-500">
                            Chưa có kỳ thi nào được cập nhật.
                        </p>
                    </Reveal>
                ) : (
                    <div className="mt-12 grid gap-5 md:grid-cols-3">
                        {schedules.map((s, i) => (
                            <Reveal key={s.id} delay={i * 100} className="flex">
                                <div className="flex flex-1 flex-col rounded-xl border bg-white p-6
                                                transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                                    <div className="flex items-start justify-between">
                                        <span className="rounded-lg bg-blue-50 px-3 py-2 text-center">
                                            <span className="block text-xl font-bold leading-none text-blue-700">
                                                {new Date(s.examDate).getDate()}
                                            </span>
                                            <span className="text-[10px] uppercase text-blue-500">
                                                Th{new Date(s.examDate).getMonth() + 1}
                                            </span>
                                        </span>
                                        {/* Chuông = tính năng đặt nhắc; bấm phải đăng nhập vì nhắc gắn với user */}
                                        <button
                                            onClick={() => requireAuth('/exam-schedule')}
                                            title="Đặt nhắc email trước 3 ngày"
                                            className="rounded-lg p-2 text-gray-300 transition-colors
                                                       hover:bg-amber-50 hover:text-amber-500"
                                        >
                                            <Bell size={18} />
                                        </button>
                                    </div>

                                    <h3 className="mt-4 font-semibold leading-snug text-gray-900">{s.title}</h3>
                                    <p className="mt-1 text-xs text-gray-500">{s.organizer}</p>

                                    <div className="mt-4 space-y-1.5 text-sm text-gray-600">
                                        <p className="flex items-center gap-1.5">
                                            <MapPin size={14} className="shrink-0 text-gray-400" /> {s.city}
                                        </p>
                                        {s.registrationDeadline && (
                                            <p className="flex items-center gap-1.5">
                                                <CalendarDays size={14} className="shrink-0 text-gray-400" />
                                                Hạn ĐK: {new Date(s.registrationDeadline).toLocaleDateString('vi-VN')}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => requireAuth('/exam-schedule')}
                                        className="mt-5 flex flex-1 items-end text-sm font-semibold text-blue-600 hover:underline"
                                    >
                                        Đặt nhắc email →
                                    </button>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                )}
            </section>

            {/* ── Cách hoạt động ───────────────────────────────────── */}
            <section id="how" className="mx-auto max-w-5xl px-6 py-20">
                <Reveal>
                    <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                        Ba bước để biết trình độ hiện tại
                    </h2>
                </Reveal>
                <div className="mt-12 grid gap-8 md:grid-cols-3">
                    {STEPS.map((s, i) => (
                        <Reveal key={s.n} delay={i * 150}>
                            <div className="text-center">
                                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full
                                                 bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-600/30">
                                    {s.n}
                                </span>
                                <h3 className="mt-4 font-semibold text-gray-900">{s.title}</h3>
                                <p className="mt-1.5 text-sm text-gray-600">{s.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── CTA cuối ─────────────────────────────────────────── */}
            <section className="bg-gradient-to-r from-blue-700 to-blue-600 py-20 text-center text-white">
                <Reveal>
                    <div className="mx-auto max-w-2xl px-6">
                        <h2 className="text-2xl font-bold sm:text-3xl">Bắt đầu bằng một lần thi thử</h2>
                        <p className="mt-3 text-blue-100">
                            Mất 2 tiếng, biết được điểm hiện tại và cần ôn Part nào.
                        </p>
                        <button
                            onClick={() => requireAuth('/mock-test')}
                            className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-8 py-4
                                       font-bold shadow-xl shadow-orange-900/20 transition-all duration-300
                                       hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-2xl"
                        >
                            <Zap size={18} className="transition-transform group-hover:scale-110" />
                            Thi thử miễn phí
                        </button>
                    </div>
                </Reveal>
            </section>

            <footer className="border-t bg-white py-8 text-center text-sm text-gray-500">
                <p>TOEIC Master — dự án luyện thi TOEIC.</p>
                <p className="mt-1 text-xs">
                    TOEIC là nhãn hiệu đã đăng ký của ETS. Dự án không liên kết với ETS;
                    nội dung dùng cho mục đích học tập.
                </p>
            </footer>

            {/* Popup đăng nhập/đăng ký — mở khi bấm chức năng cần auth */}
            <AuthDialog
                open={authTarget !== null}
                returnTo={authTarget ?? '/dashboard'}
                onClose={() => setAuthTarget(null)}
            />
        </div>
    )
}

/**
 * Bọc một khối để nó "hiện dần" khi cuộn tới: mờ + dịch lên 16px → rõ + về vị trí.
 *
 * `delay` để các thẻ trong cùng hàng xuất hiện lệch nhau (stagger) — nhìn có nhịp
 * hơn là cả 6 thẻ bật cùng lúc. Dùng inline style vì Tailwind không có class
 * delay động theo biến.
 */
function Reveal({
    children, delay = 0, className = '',
}: { children: React.ReactNode; delay?: number; className?: string }) {
    const { ref, inView } = useInView<HTMLDivElement>()
    return (
        <div
            ref={ref}
            className={`transition-all duration-700 ease-out ${
                inView ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            } ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    )
}

/** Thanh điểm Listening/Reading trong ảnh minh họa hero */
function ScoreBar({ label, score, icon: Icon }: { label: string; score: number; icon: typeof Headphones }) {
    return (
        <div>
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-600">
                    <Icon size={14} /> {label}
                </span>
                <span className="font-semibold text-gray-900">{score}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                {/* 495 là điểm tối đa mỗi section theo thang TOEIC */}
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${(score / 495) * 100}%` }} />
            </div>
        </div>
    )
}
