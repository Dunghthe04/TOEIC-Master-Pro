import { Navigate, useSearchParams } from 'react-router-dom'

/**
 * TRANG TƯƠNG THÍCH NGƯỢC — không còn UI riêng.
 *
 * Link đặt lại mật khẩu giờ trỏ về landing page ("/?reset=1&email=…&token=…") và form
 * nằm trong AuthDialog: người bấm link là khách chưa đăng nhập, nơi họ thuộc về là
 * landing page, không phải một trang trắng trơ trọi không header không đường quay lại.
 *
 * Route này giữ lại vì các email ĐÃ GỬI trước khi đổi vẫn trỏ tới /reset-password —
 * xoá đi là những link đó chết. Nó chỉ chuyển tiếp query sang luồng mới, để chỉ còn
 * MỘT chỗ chứa form (không phải sửa hai nơi mỗi lần đổi luật mật khẩu).
 */
export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams()

    const email = searchParams.get('email')
    const token = searchParams.get('token')

    // Thiếu tham số cũng cứ đẩy về landing kèm reset=1: popup sẽ hiện "Link không hợp lệ"
    // — cùng một thông báo, một chỗ duy nhất, thay vì mỗi trang nói một kiểu.
    const params = new URLSearchParams({ reset: '1' })
    if (email) params.set('email', email)
    if (token) params.set('token', token)

    return <Navigate to={`/?${params}`} replace />
}
