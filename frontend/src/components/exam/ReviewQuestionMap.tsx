/**
 * Bảng số câu của màn XEM LẠI ĐÁP ÁN — bấm một ô là nhảy tới câu đó.
 *
 * ─── KHÁC GÌ `ReadingQuestionPalette` (bảng lúc đang thi) ───────────────────────────
 *
 * Nhìn thì giống, nhưng ba thứ cốt lõi đều khác, nên tách hẳn ra file riêng thay vì
 * nhồi thêm cờ vào bảng cũ:
 *
 *                 lúc THI                          lúc XEM LẠI
 *   Ô cho biết    đã chọn / chưa chọn / đánh dấu   ĐÚNG / SAI / BỎ QUA
 *   Bấm vào thì   ĐỔI MÀN (mỗi lúc chỉ 1 màn)      CUỘN TỚI (mọi câu cùng trên 1 trang)
 *   Phạm vi       chỉ Reading                      cả 200 câu, Listening lẫn Reading
 *
 * Ba khác biệt đó ăn vào từng dòng của component. Gộp làm một thì mỗi thuộc tính phải
 * kèm một câu "nếu đang thi thì…", và bảng lúc thi là thứ không được phép hỏng.
 *
 * Ô VUÔNG chứ không tròn như bảng lúc thi — cố ý: nhìn một cái là biết mình đang ở màn
 * xem lại chứ không phải đang thi.
 */
import { LayoutGrid, X } from 'lucide-react'
import { partToNumber } from '@/lib/examListening'

export type ReviewMapItem = {
    order: number
    part: string
    status: 'correct' | 'wrong' | 'skipped'
}

export type ReviewFilter = 'all' | 'correct' | 'wrong' | 'skipped'

type ReviewQuestionMapProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    items: ReviewMapItem[]
    /** Câu vừa được nhảy tới — khoanh viền để mắt biết mình đang ở đâu. */
    focusedOrder: number | null
    onJump: (order: number) => void
    filter: ReviewFilter
    onFilterChange: (filter: ReviewFilter) => void
}

/** Màu ô theo kết quả — dùng ĐÚNG bảng màu của phần xem lại để không phải học lại lần hai. */
function cellStyle(
    status: ReviewMapItem['status'],
    isFocused: boolean,
    dimmed: boolean
): string {
    const base =
        'flex h-9 w-9 items-center justify-center rounded-md text-[13px] font-bold tabular-nums transition-all'

    const tone =
        status === 'correct'
            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
            : status === 'wrong'
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-amber-400 text-amber-950 hover:bg-amber-500'

    return [
        base,
        tone,
        // Vẫn bấm được khi mờ — thấy câu nào muốn xem thì bấm luôn, không phải đổi bộ lọc
        // trước rồi mới tìm lại. `onJump` tự gỡ bộ lọc.
        dimmed ? 'opacity-25 hover:opacity-100' : '',
        isFocused ? 'ring-2 ring-[#1a4d7c] ring-offset-2' : '',
    ]
        .filter(Boolean)
        .join(' ')
}

function FilterButton({
    active,
    onClick,
    label,
    count,
    tone,
}: {
    active: boolean
    onClick: () => void
    label: string
    count: number
    tone: 'all' | 'correct' | 'wrong' | 'skipped'
}) {
    const activeTone =
        tone === 'correct'
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : tone === 'wrong'
              ? 'bg-rose-600 border-rose-600 text-white'
              : tone === 'skipped'
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'bg-[#1a4d7c] border-[#1a4d7c] text-white'

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-col items-center rounded-md border px-1 py-1.5 transition-colors ${
                active
                    ? activeTone
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
        >
            <span className="text-sm font-bold tabular-nums leading-none">{count}</span>
            <span className="mt-0.5 text-[10px] font-medium leading-none">{label}</span>
        </button>
    )
}

export default function ReviewQuestionMap({
    open,
    onOpenChange,
    items,
    focusedOrder,
    onJump,
    filter,
    onFilterChange,
}: ReviewQuestionMapProps) {
    // Gom theo Part, giữ thứ tự số câu. Không dùng useMemo: danh sách 200 phần tử, gom lại
    // là vài chục micro-giây, mà panel chỉ render lại khi đổi bộ lọc.
    const byPart = new Map<number, ReviewMapItem[]>()
    for (const item of [...items].sort((a, b) => a.order - b.order)) {
        const n = partToNumber(item.part)
        const list = byPart.get(n) ?? []
        list.push(item)
        byPart.set(n, list)
    }

    const wrong = items.filter((i) => i.status === 'wrong').length
    const skipped = items.filter((i) => i.status === 'skipped').length
    const correct = items.filter((i) => i.status === 'correct').length
    const notCorrect = wrong + skipped

    return (
        <>
            {/* Nút mở, góc dưới-phải.
                Huy hiệu đỏ đếm số câu CHƯA ĐÚNG: con số quan trọng nhất của cả màn này giờ
                đọc được mà không phải mở gì — đó là lý do bỏ được thanh lọc dính trên đầu
                trang, thứ chiếm nguyên một hàng chỉ để hiện bốn con số. */}
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                className="fixed bottom-24 right-4 z-[55] flex h-14 w-14 items-center justify-center rounded-lg bg-[#1a4d7c] text-white shadow-lg transition-colors hover:bg-[#153d63] md:right-6"
                aria-label={open ? 'Đóng bản đồ câu' : 'Mở bản đồ câu'}
                aria-expanded={open}
            >
                <LayoutGrid className="h-7 w-7" />
                {notCorrect > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white ring-2 ring-white">
                        {notCorrect}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-[60] bg-black/30"
                        aria-label="Đóng"
                        onClick={() => onOpenChange(false)}
                    />
                    <aside
                        className="fixed bottom-[4.5rem] right-0 top-[7.5rem] z-[61] w-full max-w-sm overflow-y-auto border-l bg-[#eef2f6] shadow-2xl"
                        role="dialog"
                        aria-label="Bản đồ câu"
                    >
                        <div className="sticky top-0 z-10 border-b bg-white px-4 py-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-[#1a4d7c]">Bản đồ câu</p>
                                <button
                                    type="button"
                                    onClick={() => onOpenChange(false)}
                                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                                    aria-label="Đóng"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Bộ lọc chuyển vào đây, thay cho thanh dính trên đầu trang.
                                Chỗ này hợp hơn hẳn: bấm "Sai" thì các ô không phải câu sai
                                MỜ ĐI NGAY trên lưới ngay bên dưới — thấy luôn câu sai nằm
                                cụm nào, Part nào. Thanh cũ chỉ đổi được nội dung trang mà
                                không cho biết chúng nằm đâu. */}
                            <div className="mt-3 grid grid-cols-4 gap-1.5">
                                <FilterButton
                                    active={filter === 'all'}
                                    onClick={() => onFilterChange('all')}
                                    label="Tất cả"
                                    count={items.length}
                                    tone="all"
                                />
                                <FilterButton
                                    active={filter === 'wrong'}
                                    onClick={() => onFilterChange('wrong')}
                                    label="Sai"
                                    count={wrong}
                                    tone="wrong"
                                />
                                <FilterButton
                                    active={filter === 'skipped'}
                                    onClick={() => onFilterChange('skipped')}
                                    label="Bỏ qua"
                                    count={skipped}
                                    tone="skipped"
                                />
                                <FilterButton
                                    active={filter === 'correct'}
                                    onClick={() => onFilterChange('correct')}
                                    label="Đúng"
                                    count={correct}
                                    tone="correct"
                                />
                            </div>
                        </div>

                        <div className="space-y-5 p-4">
                            {[...byPart.entries()].map(([partNum, list]) => {
                                const partWrong = list.filter(
                                    (i) => i.status !== 'correct'
                                ).length

                                return (
                                    <section key={partNum}>
                                        <h3 className="mb-2 flex items-baseline justify-between text-sm font-semibold text-slate-700">
                                            <span>Part {partNum}</span>
                                            {/* Số câu chưa đúng của từng Part — thấy ngay
                                                Part nào cần học lại mà không phải đếm ô */}
                                            <span className="text-xs font-normal text-slate-500">
                                                {partWrong > 0
                                                    ? `${partWrong}/${list.length} chưa đúng`
                                                    : 'đúng hết'}
                                            </span>
                                        </h3>
                                        <div className="grid grid-cols-6 gap-1.5">
                                            {list.map((item) => (
                                                <button
                                                    key={item.order}
                                                    type="button"
                                                    title={`Câu ${item.order}`}
                                                    className={cellStyle(
                                                        item.status,
                                                        item.order === focusedOrder,
                                                        // Làm MỜ chứ không ẩn: ẩn thì lưới
                                                        // co lại, số câu đổi chỗ, và mất
                                                        // luôn thông tin "câu sai nằm rải
                                                        // hay dồn một cụm" — mà đó chính là
                                                        // thứ đáng nhìn nhất ở đây.
                                                        filter !== 'all' && item.status !== filter
                                                    )}
                                                    onClick={() => {
                                                        onJump(item.order)
                                                        onOpenChange(false)
                                                    }}
                                                >
                                                    {item.order}
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                )
                            })}
                        </div>

                        <div className="space-y-1 border-t bg-white px-4 py-3 text-xs text-muted-foreground">
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded bg-rose-500" />
                                Sai ({wrong})
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded bg-amber-400" />
                                Bỏ qua ({skipped})
                            </p>
                            <p className="flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded bg-emerald-500" />
                                Đúng ({correct})
                            </p>
                        </div>
                    </aside>
                </>
            )}
        </>
    )
}
