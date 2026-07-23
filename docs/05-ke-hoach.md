# Kế hoạch phát triển

> **Giả định:** 3–5 tiếng/ngày, 6 ngày/tuần, 1 người code.
> **Tổng thời gian:** ~12 tuần (3 tháng)

---

## 🎯 Định hướng sản phẩm

**Mục đích chính (Core):** User vào web để **thi thử / làm đề TOEIC** giống format thật
(chọn đề → full test hoặc chọn Part → intro Part + audio → làm bài → nộp → kết quả).
Ưu tiên UX **mượt, đẹp, rõ hơn** các site thi thử khác.

**Mục đích phụ (Differentiator):** AI giải thích, study plan, score predictor, vocab SRS,
lịch thi, gamification, community… — làm **sau khi** luồng thi thử dùng được.

| Ưu tiên | Module | Ghi chú |
|--------|--------|---------|
| #1 Core | Mock Test / Exam Engine | Từ đề import (`Test` + `TestQuestion`) |
| #2 Phụ | Practice random (Day 25 API) | Luyện nhanh từng Part — không phải luồng chính |
| #3 Phụ | Vocab SRS, lịch thi… | Đã làm một phần (Day 19–24) |
| #4 Khác biệt | AI, gamification, community… | Phase 4+ |

---

## 👥 Day theo role (User / Content Manager / Admin)

> Một ngày có thể đụng nhiều tầng (API + UI). Cột **Role chính** = ai dùng tính năng đó trên product.
> Seed roles: `Admin`, `ContentManager`, `User`. Google login mặc định = `User`.

| Role | Day (đã / sẽ làm) | Tính năng chính |
|------|-------------------|-----------------|
| **Tất cả / nền** | 1–12 ✅ | Solution, DB, Auth JWT, Profile, Redis, logging, FE bootstrap |
| **Content Manager** (+ Admin) | 13–18 ✅ | CRUD Question/Test, import Excel, panel CM đề + câu hỏi |
| **CM** (+ Admin) | 19 ✅ | API CRUD ExamSchedule |
| **User** | 20–21 ✅ | UI lịch thi, nhắc email, iCal |
| **CM** (+ Admin) | 22 ✅ | API CRUD Vocabulary |
| **User** | 23–24 ✅ | SRS API + flashcard UI |
| **User** | 25 ✅ *(phụ)* | Practice API luyện nhanh |
| **User** *(core)* | **26–30** | Exam Engine / thi thử (API play → UI → session → kết quả) |
| **User** | 31–33 | Lịch sử thi, dashboard analytics |
| **User** | 34–36 | Gamification UI + API |
| **User** | 37–48 | AI coach, chatbot, adaptive… |
| **User** | 49–51 | 1v1 challenge |
| **User** | 52–54 | Community / blog (đọc); CM viết blog (54) |
| **Admin** | 55–57 | Admin dashboard, quản lý user, duyệt content / CM |
| **Tất cả (billing)** | 58–60 | Subscription / payment (User mua; Admin quản lý doanh thu) |
| **Dev / ops** | 61–72 | Test, deploy, launch |

### Tóm nhanh theo persona

| Persona | Đang có (đến Day 25) | Sắp làm tiếp |
|---------|----------------------|--------------|
| **User** | Auth, profile, lịch thi, vocab SRS, luyện nhanh API/UI | **Thi thử Day 26–30** (ưu tiên), rồi history / AI… |
| **Content Manager** | Panel câu hỏi + đề + import; API lịch thi & vocab | Bổ sung panel quản lý lịch thi UI (nếu cần); nội dung đề cho Exam Engine |
| **Admin** | Seed account + quyền trên API CM/Admin | UI Admin Day **55–57** |

**Lưu ý:** Frontend hiện **chưa khóa menu theo role** (User vẫn thấy “Quản lý đề/câu hỏi”). Phân quyền UI theo role nên làm kèm Admin (Day 55+) hoặc sớm hơn nếu cần — API đã `[Authorize(Roles = ...)]`.

---

## 📍 TRẠNG THÁI HIỆN TẠI

**Đang ở:** Hết **Day 27** (UI thi thử Listening + CM import/upload Part 1–4) ✅  
**Tiếp theo:** **Day 28** — Reading Part 5–7 + TestSession + nộp bài.

**Day 26 cũ (UI Practice random Part 1–4):** đã code WIP ở frontend nhưng **không phải luồng chính**.
- Giữ lại: `howler`, `AudioPlayer`, types/service Practice (tái dùng / luyện phụ).
- Không mở rộng theo hướng “khó/dễ + random” cho menu chính.
- Menu chính: **Thi thử** (`/mock-test`) lấy từ đề import.

**Lưu ý kỹ thuật còn treo:**
- Swagger **chưa có nút Authorize** → test bằng Postman/Scalar + `Authorization: Bearer <token>`.
- Tài khoản test (seed khi chạy API):
  - Admin: `admin@toeicmaster.com` / `Admin@2026`
  - Content Manager: `cm@toeicmaster.com` / `Cm@2026`
  - UI Admin tạo user = Day 55+ (chưa có); Admin cũng gọi được API CM.
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
- Ngày 22: API: danh sách từ, thêm/sửa/xóa (CM), phân chủ đề ✅
- Ngày 23: SRS engine (SM-2 algorithm), API track tiến độ học từ ✅
- Ngày 24: Flashcard UI, bài tập từ vựng, thanh tiến độ SRS ✅

</details>

<details>
<summary>⚡ Phase 3 — Exam Engine / Thi thử (CORE) (Tuần 5–6)</summary>

> Tham chiếu UX: Zenlish Test Online — chọn đề → cấu trúc full/part → intro Part (+ audio) → làm bài → nộp.

**Tuần 5 — Day 25–27: Nền API + Listening flow**
- Ngày 25: API Practice phụ (random Part/filter, nộp, chấm) ✅ — *không phải luồng chính*
- Ngày 26: **Exam Engine API** — `GET /api/test` (published), `GET /api/test/{id}/play?parts=...` ✅
  — câu theo `OrderIndex`, che đáp án; config Directions + URL audio intro Part 1–7
- Ngày 27: **UI Core — chọn đề + Listening** ✅
  — List đề; cấu trúc; Directions + playlist; Part 1–4;
  — CM: upload audio/ảnh, import Excel/ZIP, gán câu vào đề, preview Listening

**Tuần 5–6 — Day 28–30: Reading + Session + Kết quả**
- Ngày 28: API `TestSession` — tạo phiên, lưu đáp án, nộp cuối; UI Reading Part 5–7 (passage, nhóm câu, bookmark)
- Ngày 29: Polish thi thử — timer full 120′ (L~45′ gồm Directions + R 75′), progress `đã làm/tổng`, NỘP BÀI, Câu trước/sau
- Ngày 30: Màn kết quả — điểm quy đổi, phân tích theo Part, review đáp án

**Tuần 6 — Day 31–36: Lịch sử + Gamification (phụ sau core)**
- Ngày 31: API lịch sử thi, so sánh điểm qua các lần
- Ngày 32: User dashboard: biểu đồ điểm (Recharts), phân tích Part yếu
- Ngày 33: API tracking chi tiết (câu sai theo chủ đề, Part, thời gian)
- Ngày 34: XP system, daily streak logic (Hangfire check midnight)
- Ngày 35: Badges engine, leaderboard API (Redis sorted set)
- Ngày 36: UI: streak display, badge showcase, leaderboard page

**Ghi chú Day 26 cũ (Practice UI random):**
- File WIP: `PracticePage`, `practice.service`, `practice.types`, `AudioPlayer`, howler
- **Giữ** Howler + AudioPlayer (dùng cho Exam Engine)
- **Giữ** Practice API/types làm luyện phụ sau
- **Không** tiếp tục mở rộng PracticePage thành sản phẩm chính

</details>

<details>
<summary>🤖 Phase 4 — AI Integration (Tuần 7–8) — Differentiator</summary>

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
