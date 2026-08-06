import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
            <p className="text-6xl font-bold text-blue-600">404</p>
            <h1 className="text-xl font-semibold text-gray-900">Không tìm thấy trang</h1>
            <p className="text-sm text-gray-500">Đường dẫn không tồn tại hoặc bạn không có quyền truy cập.</p>
            <Button asChild><Link to="/">Về trang chủ</Link></Button>
        </div>
    )
}
