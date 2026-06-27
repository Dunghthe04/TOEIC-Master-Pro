import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

//Mục đích: Ghép Sidebar + Header + vùng nội dung thành layout hoàn chỉnh.
//<Outlet /> là nơi từng page (Dashboard, Practice...) được render vào — không cần lặp lại Sidebar/Header ở mỗi page.

export default function MainLayout() {
    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}