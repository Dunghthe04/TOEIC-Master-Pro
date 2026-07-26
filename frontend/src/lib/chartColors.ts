/**
 * Bảng màu dùng chung cho mọi biểu đồ (Day 32+).
 *
 * Bộ CHART_SERIES đã chạy qua validator màu:
 *   - tách biệt được với người mù màu (CVD ΔE >= 8)
 *   - tách biệt với mắt thường (ΔE >= 15)
 *   - tương phản >= 3:1 trên nền trắng
 *
 * LƯU Ý: #1a4d7c (màu thương hiệu) KHÔNG dùng làm màu đường/cột —
 * nó quá tối và quá xám nên trượt 2 check trên. Giữ nó cho header, chữ, viền.
 */

/** Màu định danh cho từng series — gán theo thứ tự cố định, không xoay vòng. */
export const CHART_SERIES = {
    /** Tổng điểm — series chính, vẽ đậm nhất */
    total: '#2f7fc4',
    listening: '#7c3aed',
    reading: '#d97706',
} as const

/** Màu trạng thái — chỉ dùng cho cảnh báo, không bao giờ dùng làm "series thứ 4". */
export const CHART_STATUS = {
    /** Part yếu cần ôn — luôn đi kèm nhãn chữ, không dựa vào màu một mình */
    warning: '#d97706',
    good: '#059669',
    /** Đường mục tiêu */
    target: '#dc2626',
} as const

/** Màu chrome của chart — lưới, trục, chữ phụ. Phải lùi lại sau dữ liệu. */
export const CHART_INK = {
    grid: '#e5e7eb',
    axis: '#6b7280',
} as const

/** Màu thương hiệu — dùng cho header/chữ/viền, KHÔNG dùng cho mark dữ liệu. */
export const BRAND_NAVY = '#1a4d7c'
