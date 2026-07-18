// ──────────────────────────────────────────────────────────
// App.tsx — Component gốc (Root Component)
//
// Đây là "cái khung" bao toàn bộ app.
// Sau này App.tsx sẽ chứa Router (điều hướng giữa các trang),
// Layout chung (header, sidebar), và các Provider (auth, theme...).
//
// Hiện tại chỉ có nội dung tạm để test Tailwind + shadcn/ui.
// ──────────────────────────────────────────────────────────

// Syntax: import Button từ thư mục ui (do shadcn generate)
// "@/" là alias trỏ vào thư mục "src/" — thay thế cho "../../components/ui/button"
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import MainLayout from '@/components/layout/MainLayout'
import DashboardPage from '@/pages/DashboardPage'
import TestListPage from '@/pages/cm/TestListPage'
import TestFormPage from '@/pages/cm/TestFormPage'
import QuestionListPage from '@/pages/cm/QuestionListPage'
import QuestionFormPage from '@/pages/cm/QuestionFormPage'
import QuestionImportPage from '@/pages/cm/QuestionImportPage'



// "function App()" — định nghĩa một React Component.
// Component = một hàm JavaScript trả về JSX (HTML viết trong JS).
function App() {
  // return (...) — phần JSX này sẽ được render thành HTML thật trên trình duyệt.
  // JSX trông như HTML nhưng thực ra là JavaScript — Vite/TypeScript sẽ biên dịch nó.
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path='/login' element={<LoginPage />} />
        <Route path='/register' element={<RegisterPage />} />
        <Route path='/forgot-password' element={<ForgotPasswordPage />} />
        {/* Protected — phải login mới vào được, có layout sidebar+header */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/cm/tests" element={<TestListPage />} />
            <Route path="/cm/tests/create" element={<TestFormPage />} />
            <Route path="/cm/tests/:id/edit" element={<TestFormPage />} />
            <Route path="/cm/questions" element={<QuestionListPage />} />
            <Route path="/cm/questions/create" element={<QuestionFormPage />} />
            <Route path="/cm/questions/:id/edit" element={<QuestionFormPage />} />
            <Route path="/cm/questions/import" element={<QuestionImportPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    <Toaster richColors position="top-right" />
    </>
  )
}

// export default: cho phép các file khác import App này
// main.tsx dùng: import App from './App.tsx'
export default App
