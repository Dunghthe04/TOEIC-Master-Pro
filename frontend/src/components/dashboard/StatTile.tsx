/**
 * Thẻ số liệu đơn — Day 32.
 *
 * Dùng cho các con số "đọc phát hiểu ngay", không cần biểu đồ.
 * Con số là thứ to nhất trong thẻ; nhãn và ghi chú lùi lại phía sau.
 */
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatTileProps {
    icon: LucideIcon
    label: string
    /** Giá trị chính — truyền '—' khi chưa có dữ liệu */
    value: string | number
    /** Dòng ghi chú nhỏ bên dưới (tuỳ chọn) */
    hint?: string
    /** Tông màu của con số theo ý nghĩa: mặc định / tốt / cần cải thiện */
    tone?: 'default' | 'good' | 'warning'
    className?: string
}

const toneClass: Record<NonNullable<StatTileProps['tone']>, string> = {
    default: 'text-[#1a4d7c]',
    good: 'text-emerald-600',
    warning: 'text-amber-600',
}

export default function StatTile({
    icon: Icon,
    label,
    value,
    hint,
    tone = 'default',
    className,
}: StatTileProps) {
    return (
        <div className={cn('rounded-xl border bg-white p-4 shadow-sm', className)}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
            </div>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', toneClass[tone])}>
                {value}
            </p>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
    )
}
