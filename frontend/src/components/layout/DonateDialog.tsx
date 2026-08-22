/**
 * Popup ủng hộ — mở từ nút trái tim trong FloatingContact.
 *
 * Chọn một mức tiền (hoặc gõ số khác) là mã QR hiện ra ngay bên dưới, không phải bấm thêm
 * nút nào. Chuyển khoản xong thì popup đổi sang lời cảm ơn rồi tự đóng.
 *
 * VỀ SỐ TIỀN: payOS bắt buộc mỗi link thanh toán mang một số tiền cụ thể, nên mã QR luôn
 * điền sẵn số đã chọn. Người ủng hộ vẫn sửa được số đó trong app ngân hàng, và việc nhận ra
 * "đã có tiền vào" dựa trên amountPaid > 0 (xem PayOsDonationService) nên chuyển bao nhiêu
 * cũng được cảm ơn.
 *
 * VÌ SAO TỰ DỰNG POPUP mà không dùng <AlertDialog>: alert-dialog là để hỏi xác nhận (có nút
 * Đồng ý / Huỷ), còn ở đây cần một tấm QR đủ lớn để quét. Cách dựng (overlay bấm ra ngoài
 * để đóng, Esc, chặn cuộn trang phía sau) theo đúng AuthDialog.
 */
import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { donationService } from '@/services/donation.service'
import type { DonationQr } from '@/types/donation.types'
import { cn } from '@/lib/utils'

const AMOUNT_OPTIONS = [10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000]

// Khớp PayOs:MinAmount / MaxAmount ở backend — kiểm tại đây chỉ để báo lỗi ngay khi gõ,
// backend vẫn là chỗ chốt vì client nào cũng sửa được.
const MIN_AMOUNT = 10_000
const MAX_AMOUNT = 10_000_000

// Chờ người ta gõ xong số rồi mới tạo mã. Không có khoảng chờ này thì gõ "100000" sinh ra
// 6 link thanh toán bên payOS, đủ để tự đụng trần rate limit "donate".
const CUSTOM_DEBOUNCE_MS = 700

// Nhịp hỏi "đã nhận tiền chưa". 3 giây: đủ nhanh để lời cảm ơn hiện ra ngay sau khi người
// ta bấm xác nhận trên app ngân hàng, đủ chậm để không đụng trần rate limit
// "donate-status" (60 lần/phút/IP) khi vài người cùng ủng hộ qua một mạng.
const STATUS_POLL_MS = 3000

// Thời gian để đọc xong lời cảm ơn trước khi popup tự đóng.
const THANK_YOU_MS = 4000

// Trạng thái payOS còn có thể chờ tiền vào. Ngoài hai cái này (CANCELLED, EXPIRED, FAILED)
// là mã đã chết, phải nói ra chứ không để người ta quét một mã vô dụng.
const PENDING_STATUSES = ['PENDING', 'PROCESSING']

type Props = {
    open: boolean
    onClose: () => void
}

export default function DonateDialog({ open, onClose }: Props) {
    // Chưa chọn gì thì chưa có mã: cố ý KHÔNG chọn sẵn một mức nào, để người ủng hộ tự quyết
    // thay vì thấy một con số có sẵn rồi tưởng đó là số phải chuyển.
    const [amount, setAmount] = useState<number | null>(null)
    const [customText, setCustomText] = useState('')
    const [qr, setQr] = useState<DonationQr | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState('')
    const [paidAmount, setPaidAmount] = useState(0)
    const [isDead, setIsDead] = useState(false)

    // Đổi mức tiền vài lần liên tiếp thì các response về không theo thứ tự gửi. Không đánh
    // dấu lượt mới nhất thì mã của lần chọn TRƯỚC có thể về sau và ghi đè mã đang hiện —
    // người ta quét một mã không phải số tiền mình chọn.
    const latestRequestRef = useRef(0)
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

    // Esc để đóng + chặn cuộn trang phía sau khi popup mở
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        document.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose])

    // Dọn hẹn giờ debounce khi popup đóng, kẻo mã được tạo sau lưng người dùng.
    useEffect(() => () => clearTimeout(debounceRef.current), [])

    // CỐ Ý không xoá mã khi đóng popup: người ta hay bấm X để mở app ngân hàng rồi quay lại.
    // Giữ nguyên mã thì quét tiếp được — tạo mã mới sẽ khiến lượt chuyển khoản theo mã cũ
    // không bao giờ được popup nhận ra. Chỉ tạm dừng hỏi trạng thái cho đỡ tốn request.
    useEffect(() => {
        if (!open || !qr || paidAmount > 0 || isDead) return

        const timer = setInterval(async () => {
            try {
                const status = await donationService.getStatus(qr.orderCode)
                if (status.isPaid) setPaidAmount(status.amountPaid)
                else if (!PENDING_STATUSES.includes(status.status)) setIsDead(true)
            } catch {
                // Lỗi mạng một nhịp không đáng báo — nhịp sau hỏi lại. Báo lỗi ở đây chỉ làm
                // người đang chờ tưởng chuyển khoản của mình có vấn đề.
            }
        }, STATUS_POLL_MS)

        return () => clearInterval(timer)
    }, [open, qr, paidAmount, isDead])

    // Cảm ơn xong thì tự đóng, và trả popup về trạng thái đầu để lần ủng hộ sau là đơn mới.
    useEffect(() => {
        if (paidAmount === 0) return

        const timer = setTimeout(() => {
            onClose()
            setQr(null)
            setAmount(null)
            setCustomText('')
            setPaidAmount(0)
        }, THANK_YOU_MS)

        return () => clearTimeout(timer)
    }, [paidAmount, onClose])

    const requestQr = async (value: number) => {
        const requestId = ++latestRequestRef.current
        setAmount(value)
        setQr(null)
        setError('')
        setIsDead(false)
        setIsCreating(true)

        try {
            const created = await donationService.createQr(value)
            if (latestRequestRef.current === requestId) setQr(created)
        } catch (err: any) {
            if (latestRequestRef.current === requestId)
                setError(err.response?.data?.error ?? 'Không tạo được mã QR. Vui lòng thử lại sau.')
        } finally {
            if (latestRequestRef.current === requestId) setIsCreating(false)
        }
    }

    const pickAmount = (value: number) => {
        clearTimeout(debounceRef.current)
        setCustomText('')
        requestQr(value)
    }

    const typeCustomAmount = (text: string) => {
        const digits = text.replace(/\D/g, '')
        setCustomText(digits)
        clearTimeout(debounceRef.current)

        if (!digits) return

        debounceRef.current = setTimeout(() => {
            const value = Number(digits)
            if (value < MIN_AMOUNT || value > MAX_AMOUNT) {
                setQr(null)
                setAmount(null)
                setError(`Số tiền phải từ ${MIN_AMOUNT.toLocaleString('vi-VN')}đ đến ${MAX_AMOUNT.toLocaleString('vi-VN')}đ.`)
                return
            }
            requestQr(value)
        }, CUSTOM_DEBOUNCE_MS)
    }

    if (!open) return null

    // z-[60] chứ không phải z-50: widget liên hệ đứng ở z-50 và nằm SAU popup trong cây DOM,
    // để cùng z là mấy nút Zalo nổi đè lên tấm QR.
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Lớp phủ — bấm ra ngoài để đóng */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl
                            animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-gray-400
                               transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Đóng"
                >
                    <X size={18} />
                </button>

                {paidAmount > 0 ? (
                    <div className="px-7 pt-8 pb-7 text-center">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <Check className="size-7" strokeWidth={3} />
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-gray-900">
                            Đã thanh toán — xin cảm ơn rất nhiều
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600">
                            Đã nhận được {paidAmount.toLocaleString('vi-VN')}đ. Khoản này đi thẳng vào
                            tiền server để TOEIC Master Pro chạy tiếp.
                        </p>
                        <p className="mt-4 text-xs text-gray-400">Popup sẽ tự đóng…</p>
                    </div>
                ) : (
                    <div className="px-7 pt-8 pb-7">
                        <h3 className="text-center text-xl font-semibold text-gray-900">
                            Ủng hộ tôi để duy trì server
                        </h3>

                        {/* Hai cột từ breakpoint sm: xếp dọc hết thì popup cao hơn màn hình và
                            phải cuộn, mà tấm QR bị cắt nửa thì không quét được. */}
                        <div className="mt-5 grid items-start gap-5 sm:grid-cols-2 sm:gap-6">
                            <div>
                                {/* last:col-span-3 cho mức cuối chiếm hết hàng — đúng vì
                                    AMOUNT_OPTIONS đang có 7 mức, tức hàng cuối chỉ còn một ô. */}
                                <div className="grid grid-cols-3 gap-2">
                                    {AMOUNT_OPTIONS.map(option => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => pickAmount(option)}
                                            className={cn(
                                                'rounded-xl border py-3 text-sm font-semibold transition-colors last:col-span-3',
                                                amount === option
                                                    ? 'border-orange-400 bg-orange-50 text-orange-600'
                                                    : 'border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50/50',
                                            )}
                                        >
                                            {option.toLocaleString('vi-VN')}đ
                                        </button>
                                    ))}
                                </div>

                                <div className="mt-3">
                                    <Label htmlFor="donate-custom" className="text-xs text-gray-500">
                                        Hoặc nhập số khác
                                    </Label>
                                    <Input
                                        id="donate-custom"
                                        inputMode="numeric"
                                        placeholder={`Từ ${MIN_AMOUNT.toLocaleString('vi-VN')}đ`}
                                        value={customText}
                                        onChange={e => typeCustomAmount(e.target.value)}
                                        className="mt-1"
                                    />
                                </div>

                                {error && (
                                    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600">
                                        {error}
                                    </p>
                                )}

                                {qr && (
                                    <div className="mt-3 space-y-2 rounded-xl bg-gray-50 p-3">
                                        <p className="text-xs font-medium text-gray-500">Hoặc chuyển khoản tay</p>
                                        <AccountRow label="Ngân hàng" value={qr.bankName} />
                                        <AccountRow label="Số tài khoản" value={qr.accountNumber} copyable />
                                        <AccountRow label="Chủ tài khoản" value={qr.accountName} />
                                        <AccountRow label="Nội dung" value={qr.description} copyable />
                                        <p className="text-xs text-gray-400">
                                            Phải gõ đúng phần Nội dung, đó là cách hệ thống nhận ra lượt
                                            ủng hộ của bạn.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-3 ring-1 ring-orange-100">
                                    <div className="flex size-[240px] items-center justify-center rounded-xl bg-white p-3 text-center">
                                        {isCreating ? (
                                            <Loader2 className="size-7 animate-spin text-orange-300" />
                                        ) : qr ? (
                                            <QRCodeSVG value={qr.qrCode} size={216} level="M" marginSize={0} />
                                        ) : (
                                            <p className="px-4 text-sm text-gray-400">
                                                Chọn số tiền để hiện mã QR
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {qr && (isDead ? (
                                    <>
                                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-700">
                                            Mã này đã hết hạn hoặc bị huỷ.
                                        </p>
                                        <Button className="mt-3 w-full" onClick={() => requestQr(qr.amount)}>
                                            Lấy mã mới
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        {/* App ngân hàng sẽ điền sẵn số tiền của mã, nói trước để
                                            người ta biết mình vẫn sửa được ở bước cuối. */}
                                        <p className="mt-3 text-center text-xs text-gray-400">
                                            Mã điền sẵn {qr.amount.toLocaleString('vi-VN')}đ — bạn vẫn sửa
                                            được số tiền trong app ngân hàng.
                                        </p>
                                        <p className="mt-3 flex items-center justify-center gap-2 text-sm text-gray-500">
                                            <Loader2 className="size-4 animate-spin" />
                                            Đang chờ chuyển khoản…
                                        </p>
                                    </>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

/** Một dòng thông tin tài khoản. `copyable` cho những giá trị phải gõ lại chính xác. */
function AccountRow({ label, value, copyable }: {
    label: string
    value: string
    copyable?: boolean
}) {
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value)
            toast.success(`Đã copy ${label.toLowerCase()}`)
        } catch {
            toast.error('Trình duyệt không cho copy. Bạn chọn và copy tay nhé.')
        }
    }

    return (
        <div className="flex items-center justify-between gap-2 text-sm">
            <span className="shrink-0 text-gray-500">{label}</span>
            <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate font-medium text-gray-900">{value}</span>
                {copyable && (
                    <button
                        type="button"
                        onClick={copy}
                        className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                        aria-label={`Copy ${label.toLowerCase()}`}
                    >
                        <Copy size={14} />
                    </button>
                )}
            </span>
        </div>
    )
}
