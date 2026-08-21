/**
 * Trang giới thiệu TOEIC cho người CHƯA biết gì về kỳ thi này.
 *
 * VÌ SAO CẦN: landing page nói "thi thử 200 câu, 7 Part, quy đổi ETS" — toàn bộ
 * là thuật ngữ với người mới. Họ cần biết TOEIC là gì và đề trông ra sao TRƯỚC
 * khi dám bấm thi thử 2 tiếng.
 *
 * Route công khai (đặt trong PublicRoleLayout): khách vãng lai chính là đối tượng,
 * nhưng người đã đăng nhập bấm vào vẫn giữ header của mình.
 *
 * Hình minh hoạ từng Part dựng bằng CSS, KHÔNG dùng file ảnh — cùng cách làm với
 * ToeicSampleCertificate và card phiếu điểm ở hero landing. Câu ví dụ đều tự viết,
 * không lấy từ đề ETS (tránh vấn đề bản quyền nội dung).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowRight, BookOpen, CheckCircle2, Clock, FileText, Headphones,
    Image as ImageIcon, ListChecks, Mic, MessageSquare, Radio, Trophy,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

/** Số liệu chuẩn của TOEIC Listening & Reading — định dạng chính thức, không phải của app */
const EXAM_FACTS = [
    { icon: ListChecks, value: '200 câu', label: 'Toàn bộ là trắc nghiệm' },
    { icon: Clock, value: '120 phút', label: 'Làm liền một mạch, không nghỉ giữa giờ' },
    { icon: Trophy, value: '10 – 990', label: 'Thang điểm, không có điểm đỗ/trượt' },
    { icon: CheckCircle2, value: 'Không trừ điểm', label: 'Chọn sai không bị trừ, nên đừng bỏ trống câu nào' },
]

type PartGuide = {
    part: number
    title: string
    questionCount: number
    /** Nghe hay Đọc — quyết định màu nhãn và nhóm hiển thị */
    skill: 'Listening' | 'Reading'
    description: string
    tip: string
    mock: ReactNode
}

const PARTS: PartGuide[] = [
    {
        part: 1,
        title: 'Mô tả hình ảnh',
        questionCount: 6,
        skill: 'Listening',
        description:
            'Bạn xem một bức ảnh và nghe 4 câu mô tả. Chọn câu mô tả đúng nhất những gì đang diễn ra trong ảnh.',
        tip: 'Nhìn ảnh ngay trước khi audio chạy: đoán trước người trong ảnh đang làm gì, đồ vật đặt ở đâu.',
        mock: <Part1Mock />,
    },
    {
        part: 2,
        title: 'Hỏi và đáp',
        questionCount: 25,
        skill: 'Listening',
        description:
            'Nghe một câu hỏi rồi nghe 3 câu trả lời, chọn câu đáp lại phù hợp nhất. Đề in gần như trống — cả câu hỏi lẫn đáp án đều chỉ được nghe.',
        tip: 'Bắt bằng từ hỏi đầu câu (Who / When / Where…). Nghe đúng một từ đó là loại được hơn nửa số đáp án.',
        mock: <Part2Mock />,
    },
    {
        part: 3,
        title: 'Đoạn hội thoại',
        questionCount: 39,
        skill: 'Listening',
        description:
            'Nghe hội thoại giữa 2–3 người, mỗi đoạn trả lời 3 câu hỏi. Từ Part này trở đi, câu hỏi và đáp án CÓ in trong đề.',
        tip: 'Đọc trước 3 câu hỏi trong lúc chờ audio — biết mình cần nghe thông tin gì thì đỡ hoảng.',
        mock: <Part3Mock />,
    },
    {
        part: 4,
        title: 'Bài nói ngắn',
        questionCount: 30,
        skill: 'Listening',
        description:
            'Nghe một người nói liên tục — thông báo sân bay, tin nhắn thoại, quảng cáo — mỗi bài trả lời 3 câu hỏi.',
        tip: 'Câu đầu tiên thường tiết lộ bối cảnh: ai đang nói, nói ở đâu, nói cho ai nghe.',
        mock: <Part4Mock />,
    },
    {
        part: 5,
        title: 'Hoàn thành câu',
        questionCount: 30,
        skill: 'Reading',
        description:
            'Mỗi câu có một chỗ trống, chọn 1 trong 4 từ để câu đúng ngữ pháp và đúng nghĩa. Chỉ đọc một câu duy nhất.',
        tip: 'Nhìn dạng từ trước khi dịch: nhiều câu chỉ cần biết chỗ trống cần danh từ hay động từ là chọn được.',
        mock: <Part5Mock />,
    },
    {
        part: 6,
        title: 'Hoàn thành đoạn văn',
        questionCount: 16,
        skill: 'Reading',
        description:
            'Một đoạn văn (email, thông báo nội bộ) có 4 chỗ trống. Giống Part 5 nhưng phải đọc cả đoạn mới chọn đúng.',
        tip: 'Có chỗ trống phải đọc câu trước và câu sau mới biết chọn thời nào của động từ.',
        mock: <Part6Mock />,
    },
    {
        part: 7,
        title: 'Đọc hiểu',
        questionCount: 54,
        skill: 'Reading',
        description:
            'Đọc email, bài báo, quảng cáo… rồi trả lời câu hỏi. Có bài chỉ một văn bản, có bài phải đối chiếu 2–3 văn bản với nhau.',
        tip: 'Phần dài nhất và cũng là nơi dễ hết giờ nhất — khá nhiều người chọn làm Part 7 trước Part 5 và 6.',
        mock: <Part7Mock />,
    },
]

export default function ToeicGuidePage() {
    const { isAuthenticated } = useAuthStore()

    /**
     * Khách chưa đăng nhập không vào được /mock-test (ProtectedRoute). Trỏ về
     * "/?next=…" để LandingPage mở popup đăng nhập rồi đưa họ tới đúng chỗ —
     * cùng cách PublicGuestHeader đang làm.
     */
    const startTestTo = isAuthenticated ? '/mock-test' : '/?next=%2Fmock-test'

    const listeningParts = PARTS.filter(p => p.skill === 'Listening')
    const readingParts = PARTS.filter(p => p.skill === 'Reading')

    return (
        <div className="bg-white">
            {/* ── Mở đầu: trả lời thẳng câu hỏi "TOEIC là gì" ──────── */}
            <section className="relative overflow-hidden bg-gradient-to-b from-blue-600 to-blue-700 text-white">
                <div aria-hidden className="pointer-events-none absolute inset-0">
                    <span className="animate-hero-blob absolute -left-16 -top-24 size-72 rounded-full bg-sky-300/25 blur-3xl" />
                    <span className="animate-hero-blob absolute -right-20 top-1/3 size-80 rounded-full bg-orange-400/20 blur-3xl [animation-delay:-8s]" />
                </div>

                <div className="relative mx-auto max-w-4xl px-6 py-16 text-center lg:py-20">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                        <BookOpen size={14} /> Dành cho người mới bắt đầu
                    </span>
                    <h1 className="mt-5 text-3xl font-extrabold leading-tight sm:text-4xl">
                        TOEIC là gì?
                    </h1>
                    <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-blue-50 sm:text-lg">
                        TOEIC là bài thi đánh giá khả năng dùng tiếng Anh trong môi trường
                        làm việc. Bài phổ biến nhất là <strong>TOEIC Listening &amp; Reading</strong>:
                        chỉ nghe và đọc, không nói và không viết, làm trên giấy hoặc máy
                        bằng cách tô đáp án trắc nghiệm.
                    </p>
                    <p className="mx-auto mt-4 max-w-2xl text-sm text-blue-100">
                        Phần lớn người thi là sinh viên cần chuẩn đầu ra để tốt nghiệp, hoặc
                        người đi làm cần chứng chỉ để ứng tuyển và xét lương.
                    </p>
                </div>
            </section>

            {/* ── Bốn con số cần biết trước ─────────────────────────── */}
            <section className="mx-auto max-w-5xl px-6 py-14">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {EXAM_FACTS.map(({ icon: Icon, value, label }) => (
                        <div
                            key={value}
                            className="rounded-xl border bg-white p-5 transition-all duration-300
                                       hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                        >
                            <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-blue-600">
                                <Icon size={20} />
                            </span>
                            <p className="mt-3 text-xl font-bold text-gray-900">{value}</p>
                            <p className="mt-1 text-sm leading-relaxed text-gray-600">{label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Hai kỹ năng ───────────────────────────────────────── */}
            <section className="bg-gray-50 py-16">
                <div className="mx-auto max-w-5xl px-6">
                    <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                        Đề chia làm hai nửa
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
                        Mỗi nửa 100 câu và được tính điểm riêng. Tổng 7 Part.
                    </p>

                    <div className="mt-10 grid gap-5 md:grid-cols-2">
                        <SkillCard
                            icon={<Headphones size={22} />}
                            name="Listening"
                            vietnameseName="Phần Nghe"
                            questionCount={100}
                            duration="khoảng 45 phút"
                            partRange="Part 1 → 4"
                            note="Audio phát MỘT LẦN duy nhất, không được nghe lại và không tự tạm dừng được."
                            accent="blue"
                        />
                        <SkillCard
                            icon={<FileText size={22} />}
                            name="Reading"
                            vietnameseName="Phần Đọc"
                            questionCount={100}
                            duration="75 phút"
                            partRange="Part 5 → 7"
                            note="Bạn tự phân bổ thời gian cho cả 3 Part — đây là lý do nhiều người hết giờ ở Part 7."
                            accent="orange"
                        />
                    </div>
                </div>
            </section>

            {/* ── 7 Part, mỗi Part một khối kèm hình mô phỏng ───────── */}
            <section className="mx-auto max-w-5xl px-6 py-16">
                <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                    Bảy Part trông như thế nào
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-center text-gray-600">
                    Hình bên dưới là mô phỏng để bạn hình dung dạng đề — không phải đề thi thật.
                </p>

                <SkillHeading
                    icon={<Headphones size={18} />}
                    label="Listening — Part 1 đến 4"
                    description="Điểm chung: mọi thứ phát ra từ audio và chỉ phát một lần."
                />
                <div className="space-y-6">
                    {listeningParts.map(part => (
                        <PartSection key={part.part} {...part} />
                    ))}
                </div>

                <SkillHeading
                    icon={<FileText size={18} />}
                    label="Reading — Part 5 đến 7"
                    description="Điểm chung: không có audio, bạn tự quyết định dành bao nhiêu thời gian cho mỗi câu."
                />
                <div className="space-y-6">
                    {readingParts.map(part => (
                        <PartSection key={part.part} {...part} />
                    ))}
                </div>
            </section>

            {/* ── Điểm số được tính thế nào ─────────────────────────── */}
            <section className="bg-gray-50 py-16">
                <div className="mx-auto max-w-3xl px-6">
                    <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
                        Điểm được tính thế nào
                    </h2>
                    <p className="mt-4 text-center leading-relaxed text-gray-600">
                        Điểm TOEIC <strong>không phải</strong> là số câu đúng. Số câu đúng của
                        mỗi kỹ năng được quy đổi sang thang riêng theo bảng của ETS, nên hai
                        người cùng đúng 60 câu vẫn có thể lệch điểm nhau chút ít.
                    </p>

                    <div className="mt-8 space-y-3">
                        <ScoreRangeRow label="Listening" range="5 – 495 điểm" accent="bg-blue-500" />
                        <ScoreRangeRow label="Reading" range="5 – 495 điểm" accent="bg-orange-500" />
                        <ScoreRangeRow label="Tổng điểm" range="10 – 990 điểm" accent="bg-gray-900" strong />
                    </div>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        Không có mốc đỗ hay trượt. Mỗi trường và công ty tự đặt yêu cầu riêng —
                        thường gặp là 450, 600 hoặc 750 điểm.
                    </p>
                </div>
            </section>

            {/* ── Kết: rủ thi thử ──────────────────────────────────── */}
            <section className="bg-gradient-to-r from-blue-700 to-blue-600 py-16 text-center text-white">
                <div className="mx-auto max-w-2xl px-6">
                    <h2 className="text-2xl font-bold sm:text-3xl">
                        Cách nhanh nhất để biết mình đang ở đâu
                    </h2>
                    <p className="mt-3 leading-relaxed text-blue-100">
                        Đọc mô tả xong vẫn khó tưởng tượng bằng làm thử một lần. Thi thử miễn
                        phí để biết điểm hiện tại và Part nào mình yếu nhất.
                    </p>
                    <Link
                        to={startTestTo}
                        className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-8 py-4
                                   font-bold shadow-xl shadow-orange-900/20 transition-all duration-300
                                   hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-2xl"
                    >
                        Thi thử miễn phí
                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </section>
        </div>
    )
}

/** Thẻ tổng quan một kỹ năng (Listening / Reading) */
function SkillCard({
    icon, name, vietnameseName, questionCount, duration, partRange, note, accent,
}: {
    icon: ReactNode
    name: string
    vietnameseName: string
    questionCount: number
    duration: string
    partRange: string
    note: string
    accent: 'blue' | 'orange'
}) {
    const accentClass =
        accent === 'blue'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-orange-50 text-orange-600'

    return (
        <div className="rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
            <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 place-items-center rounded-lg ${accentClass}`}>
                    {icon}
                </span>
                <div>
                    <p className="font-bold text-gray-900">{name}</p>
                    <p className="text-xs text-gray-500">{vietnameseName}</p>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-gray-600">
                    <strong className="text-gray-900">{questionCount}</strong> câu
                </span>
                <span className="text-gray-600">{duration}</span>
                <span className="text-gray-600">{partRange}</span>
            </div>

            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                {note}
            </p>
        </div>
    )
}

/** Tiêu đề nhóm Listening / Reading trong danh sách 7 Part */
function SkillHeading({ icon, label, description }: { icon: ReactNode; label: string; description: string }) {
    return (
        <div className="mb-6 mt-12 border-l-4 border-blue-600 pl-4">
            <p className="flex items-center gap-2 font-bold text-gray-900">
                {icon} {label}
            </p>
            <p className="mt-1 text-sm text-gray-600">{description}</p>
        </div>
    )
}

/** Một Part: mô tả bên trái, hình mô phỏng bên phải */
function PartSection({ part, title, questionCount, skill, description, tip, mock }: PartGuide) {
    const badgeClass =
        skill === 'Listening'
            ? 'bg-blue-600 text-white'
            : 'bg-orange-500 text-white'

    return (
        <div className="grid gap-6 rounded-2xl border bg-white p-6 transition-shadow duration-300 hover:shadow-lg lg:grid-cols-2 lg:items-center">
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-bold ${badgeClass}`}>
                        PART {part}
                    </span>
                    <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                        {questionCount} câu
                    </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-gray-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>

                <p className="mt-4 flex gap-2 rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
                    <CheckCircle2 size={15} className="mt-px shrink-0 text-blue-600" />
                    <span><strong>Mẹo:</strong> {tip}</span>
                </p>
            </div>

            {mock}
        </div>
    )
}

// ── Hình mô phỏng ─────────────────────────────────────────
// Dùng đúng màu navy #1a4d7c của ExamShell để trông giống màn thi thật của app.

/** Khung "màn hình đề" bọc ngoài mọi hình mô phỏng */
function ExamMock({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="overflow-hidden rounded-xl border border-gray-300 bg-[#eef2f6] shadow-sm">
            <div className="bg-[#1a4d7c] px-3 py-2 text-[11px] font-semibold tracking-wide text-white">
                {label}
            </div>
            <div className="space-y-3 p-4">{children}</div>
        </div>
    )
}

/**
 * Dãy ô đáp án. `answer` tô đậm một ô để người mới thấy "chọn một đáp án nghĩa là gì".
 * Part 2 chỉ có 3 lựa chọn nên số ô truyền từ ngoài vào.
 */
function AnswerOptions({ options, answer }: { options: string[]; answer?: string }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map(option => (
                <span
                    key={option}
                    className={`grid h-7 w-7 place-items-center rounded-full border text-[11px] font-bold ${
                        option === answer
                            ? 'border-[#1a4d7c] bg-[#1a4d7c] text-white'
                            : 'border-gray-300 bg-white text-gray-500'
                    }`}
                >
                    {option}
                </span>
            ))}
        </div>
    )
}

/** Dòng chữ giả — mô phỏng văn bản mà không cần chữ thật */
function TextLines({ widths }: { widths: string[] }) {
    return (
        <div className="space-y-1.5">
            {widths.map((width, i) => (
                <span key={i} className="block h-2 rounded-full bg-gray-200" style={{ width }} />
            ))}
        </div>
    )
}

/** Nhãn "chỉ được nghe" — điểm khó nhất của Part 1 và 2 với người mới */
function AudioOnlyNote({ children }: { children: ReactNode }) {
    return (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-100 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
            <Headphones size={13} className="shrink-0" />
            {children}
        </p>
    )
}

function Part1Mock() {
    return (
        <ExamMock label="PART 1 — MÔ TẢ HÌNH ẢNH">
            <div className="grid h-32 place-items-center rounded-lg border border-gray-300 bg-white">
                <div className="text-center text-gray-400">
                    <ImageIcon size={28} className="mx-auto" />
                    <p className="mt-1 text-[11px]">Ảnh in trong đề</p>
                </div>
            </div>
            <AudioOnlyNote>4 câu mô tả chỉ được nghe, đề không in chữ nào</AudioOnlyNote>
            <AnswerOptions options={['A', 'B', 'C', 'D']} answer="C" />
        </ExamMock>
    )
}

function Part2Mock() {
    return (
        <ExamMock label="PART 2 — HỎI VÀ ĐÁP">
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-3">
                <Radio size={22} className="shrink-0 text-[#1a4d7c]" />
                {/* Sóng âm giả: cho thấy nội dung nằm ở audio, không nằm trên giấy */}
                <div className="flex flex-1 items-end gap-1">
                    {[10, 18, 8, 22, 14, 26, 11, 19, 9, 16, 24, 12].map((height, i) => (
                        <span
                            key={i}
                            className="w-1.5 rounded-full bg-[#1a4d7c]/30"
                            style={{ height: `${height}px` }}
                        />
                    ))}
                </div>
            </div>
            <AudioOnlyNote>Cả câu hỏi VÀ 3 đáp án đều chỉ được nghe</AudioOnlyNote>
            <AnswerOptions options={['A', 'B', 'C']} answer="B" />
        </ExamMock>
    )
}

function Part3Mock() {
    return (
        <ExamMock label="PART 3 — ĐOẠN HỘI THOẠI">
            <div className="space-y-2 rounded-lg border border-gray-300 bg-white p-3">
                <div className="flex items-start gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                        M
                    </span>
                    <span className="mt-1.5 h-2 flex-1 rounded-full bg-gray-200" />
                </div>
                <div className="flex items-start gap-2">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-pink-100 text-[10px] font-bold text-pink-700">
                        W
                    </span>
                    <span className="mt-1.5 h-2 flex-1 rounded-full bg-gray-200" />
                </div>
                <p className="pt-1 text-center text-[10px] text-gray-400">hội thoại — chỉ nghe</p>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-300 bg-white p-3">
                <p className="text-[11px] font-semibold text-gray-700">3 câu hỏi CÓ in trong đề:</p>
                {[32, 33, 34].map(number => (
                    <div key={number} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold tabular-nums text-[#1a4d7c]">{number}.</span>
                        <span className="h-2 flex-1 rounded-full bg-gray-200" />
                        <AnswerOptions options={['A', 'B', 'C', 'D']} />
                    </div>
                ))}
            </div>
        </ExamMock>
    )
}

function Part4Mock() {
    return (
        <ExamMock label="PART 4 — BÀI NÓI NGẮN">
            <div className="flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1a4d7c]/10 text-[#1a4d7c]">
                    <Mic size={18} />
                </span>
                <div className="flex-1">
                    <p className="text-[11px] font-semibold text-gray-700">Một người nói liên tục</p>
                    <p className="text-[10px] text-gray-500">thông báo · tin nhắn thoại · quảng cáo</p>
                </div>
            </div>

            <div className="space-y-2 rounded-lg border border-gray-300 bg-white p-3">
                {[71, 72, 73].map(number => (
                    <div key={number} className="flex items-center gap-2">
                        <span className="text-[11px] font-bold tabular-nums text-[#1a4d7c]">{number}.</span>
                        <span className="h-2 flex-1 rounded-full bg-gray-200" />
                        <AnswerOptions options={['A', 'B', 'C', 'D']} />
                    </div>
                ))}
            </div>
        </ExamMock>
    )
}

function Part5Mock() {
    return (
        <ExamMock label="PART 5 — HOÀN THÀNH CÂU">
            <div className="rounded-lg border border-gray-300 bg-white p-3">
                <p className="text-[13px] leading-relaxed text-gray-800">
                    <span className="font-bold text-[#1a4d7c]">101.</span> The quarterly report
                    must be{' '}
                    <span className="mx-0.5 inline-block w-16 border-b-2 border-dashed border-[#1a4d7c] align-bottom" />{' '}
                    before Friday.
                </p>

                <div className="mt-3 space-y-1.5">
                    {[
                        { key: 'A', text: 'submit' },
                        { key: 'B', text: 'submitted' },
                        { key: 'C', text: 'submitting' },
                        { key: 'D', text: 'submission' },
                    ].map(({ key, text }) => (
                        <p
                            key={key}
                            className={`flex items-center gap-2 rounded px-1.5 py-0.5 text-[12px] ${
                                key === 'B' ? 'bg-blue-50 font-semibold text-blue-900' : 'text-gray-600'
                            }`}
                        >
                            <span className="font-bold">({key})</span> {text}
                        </p>
                    ))}
                </div>
            </div>
            <p className="text-[11px] text-gray-500">
                Ở đây chỉ cần nhận ra chỗ trống cần dạng bị động — không phải dịch cả câu.
            </p>
        </ExamMock>
    )
}

function Part6Mock() {
    return (
        <ExamMock label="PART 6 — HOÀN THÀNH ĐOẠN VĂN">
            <div className="rounded-lg border border-gray-300 bg-white p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700">
                    <MessageSquare size={12} /> Thông báo nội bộ
                </p>

                <div className="mt-2.5 space-y-2">
                    <TextLines widths={['100%', '88%']} />
                    <p className="text-[11px]">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-800">131</span>
                        <span className="ml-1.5 inline-block h-2 w-24 rounded-full bg-gray-200 align-middle" />
                    </p>
                    <TextLines widths={['94%']} />
                    <p className="text-[11px]">
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-800">132</span>
                        <span className="ml-1.5 inline-block h-2 w-32 rounded-full bg-gray-200 align-middle" />
                    </p>
                    <TextLines widths={['100%', '70%']} />
                </div>
            </div>
            <p className="text-[11px] text-gray-500">
                Một đoạn văn có 4 chỗ trống — phải hiểu cả đoạn mới chọn đúng.
            </p>
        </ExamMock>
    )
}

function Part7Mock() {
    return (
        <ExamMock label="PART 7 — ĐỌC HIỂU">
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-300 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase text-gray-500">Văn bản</p>
                    <div className="mt-2">
                        <TextLines widths={['100%', '92%', '100%', '78%', '96%', '85%', '100%', '64%']} />
                    </div>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-300 bg-white p-3">
                    <p className="text-[10px] font-semibold uppercase text-gray-500">Câu hỏi</p>
                    {[147, 148, 149].map(number => (
                        <div key={number} className="space-y-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold tabular-nums text-[#1a4d7c]">{number}.</span>
                                <span className="h-2 flex-1 rounded-full bg-gray-200" />
                            </div>
                            <AnswerOptions options={['A', 'B', 'C', 'D']} />
                        </div>
                    ))}
                </div>
            </div>
            <p className="text-[11px] text-gray-500">
                Có bài một văn bản, có bài phải đối chiếu 2–3 văn bản với nhau.
            </p>
        </ExamMock>
    )
}

/** Một dòng thang điểm trong phần "Điểm được tính thế nào" */
function ScoreRangeRow({
    label, range, accent, strong,
}: { label: string; range: string; accent: string; strong?: boolean }) {
    return (
        <div
            className={`flex items-center justify-between rounded-xl border bg-white px-5 py-4 ${
                strong ? 'border-gray-900/20' : ''
            }`}
        >
            <span className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
                <span className={strong ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}>
                    {label}
                </span>
            </span>
            <span className={`tabular-nums ${strong ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                {range}
            </span>
        </div>
    )
}
