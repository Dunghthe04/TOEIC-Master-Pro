# Kế hoạch phát triển

> **Giả định:** 3–5 tiếng/ngày, 6 ngày/tuần, 1 người code.
> **Tổng thời gian:** ~12 tuần (3 tháng)

---

## 📍 TRẠNG THÁI HIỆN TẠI

**Đang ở:** Hết **Day 21** (Nhắc email Hangfire + export iCal + UI chuông toggle) — đã xong.
**Tiếp theo:** **Day 22** — API Vocabulary (CM CRUD từ, phân chủ đề).

**Day 21 ghi chú:**
- Email Dev dùng `ConsoleEmailSender` (in console), chưa SMTP thật.
- Hangfire dashboard: `http://localhost:5191/hangfire` — Trigger now để test job.
- UI chuông: trắng = chưa nhắc, đỏ + rung = đã nhắc, bấm lại = unsubscribe.

**Lưu ý kỹ thuật còn treo:**
- Swagger **chưa có nút Authorize** (Swashbuckle 10 + Microsoft.OpenApi 2.x đổi API security) → tạm test endpoint cần quyền bằng **Postman/Scalar + header `Authorization: Bearer <token>`**.
- Tài khoản test: Admin seed `admin@toeicmaster.com` / `Admin@2026`.
- Hangfire Dashboard Dev chưa khóa auth — production cần thêm authorization.

---

<details>
<summary>📦 Phase 1 — Nền tảng (Tuần 1–2)</summary>

**Tuần 1 — Ngày 1–3: Project Setup & Database**
- Ngày 1: Tạo solution .NET 8, cấu trúc project (API, Domain, Infrastructure, Application), cài Docker Compose (SQL Server, Redis) ✅
- Ngày 2: Thiết kế ERD, tạo Entity classes, DbContext, Migrations (User, Role, Question, Test, Vocabulary, ExamSchedule) ✅
- Ngày 3: Seed data cơ bản, cấu hình EF Core, kiểm tra kết nối ✅

**Tuần 1 — Ngày 4–6: Authentication**
- Ngày 4: ASP.NET Identity setup, JWT access token + refresh token ✅
- Ngày 5: API: Register, Login, Refresh Token, Logout, Email verification ✅
- Ngày 6: Google OAuth, Forgot/Reset Password, Rate limiting auth endpoints ✅

**Tuần 2 — Ngày 1–3: User Profile & Base Infrastructure**
- Ngày 7: API: Get/Update profile, upload avatar ✅
- Ngày 8: Redis cache service, base Repository pattern, Unit of Work ✅
- Ngày 9: Global error handling, Serilog logging, Swagger/Scalar setup, CORS ✅

**Tuần 2 — Ngày 4–6: Frontend Bootstrap**
- Ngày 10: Tạo React + TypeScript + Vite project, cài Tailwind + shadcn/ui ✅
- Ngày 11: Auth pages: Login, Register, Forgot Password (kết nối API thật) ✅
- Ngày 12: Layout chính, navigation, protected routes, auth context ✅

</details>

<details>
<summary>📋 Phase 2 — Core Content (Tuần 3–4)</summary>

**Tuần 3 — Ngày 1–3: Question & Content Management API**
- Ngày 13: API CRUD Question (text, audio, image), Part classification, tag hệ thống ✅
- Ngày 14: API CRUD Test Set (tạo đề thi, gán câu hỏi) ✅
- Ngày 15: Bulk import Excel/CSV (EPPlus), validate câu hỏi ✅

**Tuần 3 — Ngày 4–6: Content Manager Panel**
- Ngày 16: CM Dashboard: danh sách đề thi, bộ lọc, tìm kiếm ✅
- Ngày 17: Form tạo/sửa câu hỏi (TipTap editor, upload audio) ✅
- Ngày 18: Upload Excel import, xem preview, xác nhận import ✅

**Tuần 4 — Ngày 1–3: Exam Schedule Module**
- Ngày 19: API CRUD ExamSchedule, phân quyền Content Manager ✅
- Ngày 20: Giao diện lịch thi (User): bộ lọc tỉnh/tháng, card lịch thi ✅
- Ngày 21: Đặt nhắc nhở Email (Hangfire job), export iCal ✅ *(email Dev = Console; SMTP để sau)*

**Tuần 4 — Ngày 4–6: Vocabulary System**
- Ngày 22: API: danh sách từ, thêm/sửa/xóa (CM), phân chủ đề
- Ngày 23: SRS engine (SM-2 algorithm), API track tiến độ học từ
- Ngày 24: Flashcard UI, bài tập từ vựng, thanh tiến độ SRS

</details>

<details>
<summary>⚡ Phase 3 — Practice & Test Engine (Tuần 5–6)</summary>

**Tuần 5 — Ngày 1–3: Practice Module**
- Ngày 25: API lấy câu hỏi theo Part/filter, nộp đáp án, tính điểm
- Ngày 26: UI luyện Part 1–4 (audio player Howler.js, ảnh, timer tùy chọn)
- Ngày 27: UI luyện Part 5–7 (text-based, đọc hiểu), bookmark câu hỏi

**Tuần 5 — Ngày 4–6: Mock Test Engine**
- Ngày 28: API tạo phiên thi (session), lưu trạng thái, nộp bài cuối
- Ngày 29: UI thi thử: timer countdown, navigation câu hỏi, audio Part 1–4
- Ngày 30: Màn hình kết quả: điểm quy đổi, phân tích theo Part, review đáp án

**Tuần 6 — Ngày 1–3: Test History & Analytics**
- Ngày 31: API lịch sử thi, so sánh điểm qua các lần
- Ngày 32: User dashboard: biểu đồ điểm (Recharts), phân tích Part yếu
- Ngày 33: API tracking chi tiết (câu sai theo chủ đề, Part, thời gian)

**Tuần 6 — Ngày 4–6: Gamification**
- Ngày 34: XP system, daily streak logic (Hangfire check midnight)
- Ngày 35: Badges engine, leaderboard API (Redis sorted set)
- Ngày 36: UI: streak display, badge showcase, leaderboard page

</details>

<details>
<summary>🤖 Phase 4 — AI Integration (Tuần 7–8)</summary>

**Tuần 7 — Ngày 1–3: AI Explanation Engine**
- Ngày 37: Tích hợp Claude API, tạo AIService
- Ngày 38: Prompt engineering: giải thích đáp án song ngữ Việt-Anh
- Ngày 39: Cache AI response Redis, rate limit per user

**Tuần 7 — Ngày 4–6: AI Study Plan & Score Predictor**
- Ngày 40: Thu thập data lịch sử → prompt AI tạo study plan
- Ngày 41: API generate/save study plan, hiển thị lịch học hằng ngày
- Ngày 42: Score predictor: lịch sử → AI ước tính điểm thật

**Tuần 8 — Ngày 1–3: AI Chatbot**
- Ngày 43: SignalR Hub cho chat real-time, lưu lịch sử hội thoại
- Ngày 44: System prompt TOEIC-specific, multi-turn conversation context
- Ngày 45: UI chatbot: bubble chat, typing indicator, quick-question chips

**Tuần 8 — Ngày 4–6: AI Polish & Adaptive Testing**
- Ngày 46: Adaptive testing: chọn câu hỏi theo difficulty dựa trên performance
- Ngày 47: Weak area auto-detection → gợi ý đề luyện
- Ngày 48: Kiểm thử AI features, tối ưu prompt, xử lý fallback

</details>

<details>
<summary>🚀 Phase 5 — Advanced Features (Tuần 9–10)</summary>

**Tuần 9 — Ngày 1–3: Real-time Challenge**
- Ngày 49: SignalR Hub challenge: match-making, đồng bộ timer
- Ngày 50: Game loop: gửi câu hỏi, nhận đáp án, cập nhật điểm real-time
- Ngày 51: UI challenge: màn hình 2 người thi, live score, kết quả

**Tuần 9 — Ngày 4–6: Community & Blog**
- Ngày 52: API forum: tạo bài, comment, like, tag
- Ngày 53: UI forum: danh sách, bài viết, comment thread
- Ngày 54: Blog/Tips section (Content Manager viết, user đọc)

**Tuần 10 — Ngày 1–3: Admin Dashboard**
- Ngày 55: Admin UI: thống kê tổng quan (chart DAU/MAU)
- Ngày 56: Quản lý user: tìm kiếm, filter, khóa tài khoản
- Ngày 57: Quản lý content: duyệt/ẩn đề thi, quản lý CM accounts

**Tuần 10 — Ngày 4–6: Subscription & Payment**
- Ngày 58: Tích hợp VNPAY / Momo payment gateway
- Ngày 59: Logic phân quyền theo gói (Free/Premium/Premium Plus)
- Ngày 60: Quản lý subscription: gia hạn, hủy, email billing

</details>

<details>
<summary>✅ Phase 6 — Hoàn thiện & Triển khai (Tuần 11–12)</summary>

**Tuần 11: Testing & Bug Fixing**
- Ngày 61–62: Unit Tests cho Services, Integration Tests cho API
- Ngày 63–64: End-to-end testing (Playwright), fix bugs
- Ngày 65–66: Performance testing, load test API, optimize slow queries

**Tuần 12: Deployment & Launch**
- Ngày 67: Dockerize toàn bộ app (API + Frontend + Nginx)
- Ngày 68: Setup CI/CD GitHub Actions
- Ngày 69: Deploy lên VPS/Azure, cấu hình SSL, domain
- Ngày 70: Smoke test production, setup monitoring (Grafana)
- Ngày 71: Soft launch, thu thập feedback
- Ngày 72: Hotfix, chuẩn bị roadmap v2

</details>
