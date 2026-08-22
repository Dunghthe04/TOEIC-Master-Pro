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
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import FloatingContact from '@/components/layout/FloatingContact'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import ResetPasswordPage from './pages/auth/ResetPasswordPage'
import ConfirmEmailPage from './pages/auth/ConfirmEmailPage'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import DashboardPage from '@/pages/DashboardPage'
import TestListPage from '@/pages/cm/TestListPage'
import TestFormPage from '@/pages/cm/TestFormPage'
import TestQuestionsPage from '@/pages/cm/TestQuestionsPage'
import QuestionListPage from '@/pages/cm/QuestionListPage'
import QuestionFormPage from '@/pages/cm/QuestionFormPage'
import QuestionImportPage from '@/pages/cm/QuestionImportPage'
import ExamSchedulePage from '@/pages/ExamSchedulePage'
import VocabularyPage from '@/pages/VocabularyPage'
import PracticePage from '@/pages/PracticePage'
import MockTestPage from '@/pages/MockTestPage'
import MockTestStructurePage from '@/pages/MockTestStructurePage'
import MockTestPlayPage from '@/pages/MockTestPlayPage'
import TestHistoryPage from '@/pages/TestHistoryPage'
import TestHistoryDetailPage from '@/pages/TestHistoryDetailPage'
import TestProgressPage from '@/pages/TestProgressPage'
import CertificatePreviewPage from '@/pages/CertificatePreviewPage'
import LandingPage from '@/pages/LandingPage'
import ToeicGuidePage from '@/pages/ToeicGuidePage'
import ProfilePage from '@/pages/ProfilePage'
import RoleLayout from '@/components/layout/RoleLayout'
import PublicRoleLayout from '@/components/layout/PublicRoleLayout'
import RequireRole from '@/components/auth/RequireRole'
import CmHomePage from '@/pages/cm/CmHomePage'
import AdminOverviewPage from '@/pages/admin/AdminOverviewPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminContentPage from '@/pages/admin/AdminContentPage'
import AdminUserDetailPage from '@/pages/admin/AdminUserDetailPage'
import AdminMonitorPage from '@/pages/admin/AdminMonitorPage'
import AdminAuditLogPage from '@/pages/admin/AdminAuditLogPage'
import NotFoundPage from '@/pages/NotFoundPage'
import { useSilentRefresh } from './hooks/useSilentRefresh'



// "function App()" — định nghĩa một React Component.
// Component = một hàm JavaScript trả về JSX (HTML viết trong JS).
function App() {
  // return (...) — phần JSX này sẽ được render thành HTML thật trên trình duyệt.
  // JSX trông như HTML nhưng thực ra là JavaScript — Vite/TypeScript sẽ biên dịch nó.
  const ready = useSilentRefresh()
  if (!ready) return null 

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Landing page — mặc định vào web là thấy đây, KHÔNG bắt đăng nhập.
              Khách xem được tính năng + danh sách đề; bấm chức năng mới hiện popup login. */}
          <Route path="/" element={<LandingPage />} />
          <Route path='/login' element={<LoginPage />} />
          <Route path='/register' element={<RegisterPage />} />
          <Route path='/forgot-password' element={<ForgotPasswordPage />} />
          <Route path='/reset-password' element={<ResetPasswordPage />} />
          <Route path='/confirm-email' element={<ConfirmEmailPage />} />

          {/* CÔNG KHAI nhưng VẪN CÓ HEADER khi đã đăng nhập.
              Hai route này nằm ngoài <ProtectedRoute> để khách vãng lai xem được —
              nhưng <RoleLayout> lại ở bên trong đó, nên nếu để trần thì user đang
              đăng nhập bấm vào sẽ rơi vào trang trơ trọi, mất cả đường quay lại.
              <PublicRoleLayout> cấp đúng layout theo vai khi đã đăng nhập, và
              render trần khi chưa (avatar + nút Đăng xuất là vô nghĩa với khách). */}
          <Route element={<PublicRoleLayout />}>
            {/* Backend GET /api/test/{id}/structure đã [AllowAnonymous]: chỉ trả bảng
                "Part 1: 6 câu, Part 2: 25 câu…", KHÔNG có nội dung câu hỏi hay đáp án.
                Bấm "Bắt đầu thi" mới cần đăng nhập (/play đòi role User). */}
            <Route path="/mock-test/:id" element={<MockTestStructurePage />} />

            {/* Lịch thi TOEIC — GET /api/examschedule đã [AllowAnonymous] từ Day 34. */}
            <Route path="/exam-schedule" element={<ExamSchedulePage />} />

            {/* Giới thiệu TOEIC cho người chưa biết — nội dung tĩnh, không gọi API nào.
                Khách vãng lai là đối tượng chính, nên phải nằm ngoài ProtectedRoute. */}
            <Route path="/toeic-guide" element={<ToeicGuidePage />} />
          </Route>

          {/* Protected — phải login mới vào được, có layout sidebar+header */}
          <Route element={<ProtectedRoute />}>
            {/* RoleLayout tự chọn: User → header ngang · CM/Admin → sidebar dọc */}
            <Route element={<RoleLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />

              {/* Trang cá nhân — KHÔNG bọc RequireRole: cả ba vai đều có profile của
                  chính mình, khớp [Authorize] trần ở ProfileController. */}
              <Route path="/profile" element={<ProfilePage />} />

              {/* /cm/* chỉ CM hoặc Admin (RequireRole) — chặn ở đây chỉ là UX, bảo mật
                  thật nằm ở [Authorize(Roles="ContentManager")] phía server (Day 35) */}
              <Route element={<RequireRole allow={['ContentManager', 'Admin']} />}>
                <Route path="/cm" element={<CmHomePage />} />
                <Route path="/cm/tests" element={<TestListPage />} />
                <Route path="/cm/tests/create" element={<TestFormPage />} />
                <Route path="/cm/tests/:id/edit" element={<TestFormPage />} />
                <Route path="/cm/tests/:id/questions" element={<TestQuestionsPage />} />
                <Route path="/cm/questions" element={<QuestionListPage />} />
                <Route path="/cm/questions/create" element={<QuestionFormPage />} />
                <Route path="/cm/questions/:id/edit" element={<QuestionFormPage />} />
                <Route path="/cm/questions/import" element={<QuestionImportPage />} />
              </Route>

              {/* /admin/* chỉ Admin — trang chủ Admin, chỉ xem không CRUD nội dung */}
              <Route element={<RequireRole allow={['Admin']} />}>
                <Route path="/admin" element={<AdminOverviewPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
                <Route path="/admin/content" element={<AdminContentPage />} />
                <Route path="/admin/monitor" element={<AdminMonitorPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogPage />} />
              </Route>

              {/* /exam-schedule đã khai CÔNG KHAI ở trên — không đặt lại trong ProtectedRoute */}
              <Route path="/vocabulary" element={<VocabularyPage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/mock-test" element={<MockTestPage />} />
              <Route path="/mock-test/history" element={<TestHistoryPage />} />
              <Route path="/mock-test/progress" element={<TestProgressPage />} />
              <Route path="/mock-test/certificate-preview" element={<CertificatePreviewPage />} />
              {/* /mock-test/:id đã khai CÔNG KHAI ở trên — không đặt lại trong ProtectedRoute */}
            </Route>
            {/* Thi thử — full màn hình, không sidebar */}
            <Route path="/mock-test/history/:sessionId" element={<TestHistoryDetailPage />} />
            <Route path="/mock-test/:id/play" element={<MockTestPlayPage />} />
          </Route>

          {/* Route sai / gõ nhầm URL — phải đặt CUỐI CÙNG, React Router khớp thứ tự trên xuống */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>

        {/* Widget liên hệ — nằm ngoài <Routes> nên không mount lại mỗi lần đổi trang.
            Chỉ dành cho học viên và khách vãng lai: tự ẩn ở trang xác thực, màn làm bài
            và với vai Admin/CM. Xem HIDDEN_ROUTES trong FloatingContact. */}
        <FloatingContact />
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </>
  )
}

// export default: cho phép các file khác import App này
// main.tsx dùng: import App from './App.tsx'
export default App
