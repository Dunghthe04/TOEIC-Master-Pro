# Công nghệ sử dụng

> **Quy ước cột Trạng thái** — đối chiếu với code thật, cập nhật 2026-07-26:
> ✅ đang chạy trong code · ⚠️ có nhưng tạm/chưa hoàn chỉnh · ⬜ mới nằm trong kế hoạch
>
> Bảng này là **nguồn sự thật**. Không ghi vào đây thứ chưa có trong code.

<details>
<summary>📋 Bảng tổng hợp stack</summary>

### Backend
| Layer | Công nghệ | Trạng thái |
|---|---|---|
| Framework | ASP.NET Core 8 (Web API) | ✅ |
| Kiến trúc | Clean Architecture 4 tầng (Domain / Application / Infrastructure / API) | ✅ |
| ORM | Entity Framework Core 8 | ✅ |
| Truy cập dữ liệu | Repository\<T\> + UnitOfWork tự viết | ✅ |
| Database | SQL Server 2022 | ✅ |
| Cache | Redis (StackExchange.Redis) — **đã dựng, chưa service nào dùng** | ⚠️ |
| Auth | ASP.NET Identity + JWT + Refresh Token + Google OAuth | ✅ |
| Background Jobs | Hangfire (lưu job vào SQL Server) | ✅ |
| Import Excel | EPPlus | ✅ |
| Logging | Serilog (Console + File, xoay theo ngày) | ✅ |
| API Docs | Swagger + Scalar (chỉ bật ở Development) | ✅ |
| Rate limiting | `RateLimiter` built-in của .NET 8 | ✅ |
| Xử lý lỗi | `IExceptionHandler` + ProblemDetails | ✅ |
| Email | `ConsoleEmailSender` — in ra console, chưa gửi thật | ⚠️ |
| File Storage | Lưu thẳng vào `wwwroot` trên đĩa | ⚠️ |
| Real-time | SignalR | ⬜ chưa cài package |
| AI | Claude API (Anthropic) | ⬜ chưa bắt đầu |

### Frontend
| Layer | Công nghệ | Trạng thái |
|---|---|---|
| Build Tool | Vite 8 | ✅ |
| Framework | **React 19** + TypeScript 6 | ✅ |
| UI | shadcn/ui + Tailwind CSS 4 | ✅ |
| State toàn cục | Zustand 5 (+ middleware `persist`) | ✅ |
| Gọi API | **Axios** — instance dùng chung + interceptor gắn JWT | ✅ |
| Form | React Hook Form + Zod | ✅ |
| Routing | React Router 7 | ✅ |
| Audio | Howler.js | ✅ |
| Charts | Recharts (thư viện biểu đồ React, dựa trên D3) | ✅ |
| Rich Text | TipTap (content manager) | ✅ |
| Toast | Sonner | ✅ |
| Google Sign-In | @react-oauth/google | ✅ |
| Server-state cache | TanStack Query | ⬜ **không dùng** — gọi axios trực tiếp trong `useEffect` |

### DevOps
| Item | Công nghệ | Trạng thái |
|---|---|---|
| Container (dev) | Docker Compose — SQL Server + Redis | ✅ |
| Container (app) | Dockerfile cho API và Frontend | ⬜ chưa viết |
| CI/CD | GitHub Actions | ⬜ `.github/workflows` đang rỗng |
| Reverse Proxy | Nginx | ⬜ chưa |
| Hosting | VPS Ubuntu | ⬜ chưa deploy lần nào |
| Monitoring | Grafana + Prometheus | ⬜ chưa |

</details>

---

<details>
<summary>🗄️ SQL Server 2022 — Database chính</summary>

**Là gì:** Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) của Microsoft.

**Tại sao dùng:** Tích hợp tốt nhất với .NET/EF Core, hỗ trợ JSON columns, Full-text search cho tìm kiếm câu hỏi, transaction mạnh cho việc chấm bài thi.

**Dùng để lưu:** Toàn bộ dữ liệu chính — users, câu hỏi, đề thi, kết quả, từ vựng, lịch thi, bình luận.

**Trong Docker:** Chạy ở **`localhost:1434`** (compose map `1434:1433` để không đụng SQL Server cài sẵn trên máy), tài khoản `sa`, password trong `.env`.

> ⚠️ Docker chỉ cung cấp SQL Server engine (phần mềm). Muốn có tables thì phải chạy EF Core Migrations.

</details>

---

<details>
<summary>⚡ Redis — Cache & Real-time Data</summary>

**Là gì:** Cơ sở dữ liệu in-memory (lưu trong RAM) dạng key-value, cực kỳ nhanh (~0.1ms so với ~5ms của SQL Server).

**Tại sao dùng:** Những dữ liệu đọc nhiều, viết ít thì cache vào Redis thay vì query SQL Server mỗi lần → giảm tải DB, tăng tốc response.

> ⚠️ **SỰ THẬT (kiểm chứng 2026-07-26): Redis đã dựng dây nhưng CHƯA DÙNG.**
> `ICacheService` chỉ xuất hiện ở dòng đăng ký DI (`Program.cs:67`) và chính class implement —
> **không service nào inject nó**. Rate limiting hiện dùng bộ đếm **in-memory** của .NET, không phải Redis.
>
> Nghịch lý: là code chết nhưng lại là **dependency bắt buộc lúc khởi động** (`Program.cs:66` connect
> đồng bộ) → Redis sập là API không start được.
> Xem [09-hien-trang-va-khuyen-nghi.md](09-hien-trang-va-khuyen-nghi.md) mục 1.6.

**Dự kiến dùng để (⬜ chưa cái nào được implement):**
| Mục đích | Ví dụ cụ thể |
|---|---|
| Cache AI response | Giải thích câu hỏi đã có → cache 7 ngày, lần sau không gọi API lại |
| Cache dashboard stats | Query nặng nhất hệ thống, chỉ đổi khi user nộp bài mới |
| JWT Blacklist | Token bị logout → lưu vào Redis đến hết expire |
| Leaderboard | `ZADD leaderboard 2450 userId` → `ZREVRANGE` lấy top 10 tức thì |
| Session thi thử | Lưu trạng thái bài đang làm tránh mất dữ liệu |

**Trong Docker:** Chạy ở `localhost:6379`. Tool xem dữ liệu: **RedisInsight** (GUI miễn phí).

</details>

---

<details>
<summary>🚫 MediatR / FluentValidation / Mapster — cân nhắc nhưng KHÔNG dùng</summary>

> **Sự thật:** ba package này được cài từ những ngày đầu dự án nhưng **chưa từng có dòng code nào dùng tới**.
> Đã gỡ khỏi `ToeicMasterPro.Application.csproj` ngày 2026-07-26.
>
> Giữ mục này lại vì **phỏng vấn rất hay hỏi "sao không dùng CQRS/AutoMapper?"** — và trả lời được
> *vì sao không cần* thì mạnh hơn nhiều so với dùng theo quán tính.

---

### 🔀 MediatR — Mediator pattern / CQRS

**Là gì:** Controller không gọi thẳng service, mà gửi một "request object"; MediatR tìm đúng handler xử lý.

```
POST /api/test-session/{id}/submit
  → Controller.Submit()
  → mediator.Send(new SubmitTestCommand(sessionId))
  → SubmitTestCommandHandler.Handle()     ← MediatR tự tìm handler
```

**CQRS** = tách lệnh ghi (Command) khỏi lệnh đọc (Query), để hai bên tối ưu độc lập — thường đi kèm hai model dữ liệu, đôi khi hai database.

**Vì sao dự án này KHÔNG dùng:**

| Lý do | Cụ thể |
|---|---|
| Thêm tầng gián tiếp mà không giải quyết vấn đề gì | Hiện tại `Controller → IService → Repository`. Thêm MediatR thành `Controller → Command → Handler → Repository` — dài hơn một tầng, lợi ích bằng 0 ở quy mô này |
| Lợi ích thật của MediatR là **pipeline behavior** | Logging, validation, transaction dùng chung cho mọi request. Dự án đang giải quyết bằng middleware (`GlobalExceptionHandler`, `UseSerilogRequestLogging`) — rẻ hơn |
| CQRS đúng nghĩa cần tách model đọc/ghi | Dự án dùng chung entity cho cả hai. Cài MediatR mà vẫn một model thì đó **không phải CQRS**, chỉ là đổi cách gọi hàm |
| Khó debug hơn | Bấm "Go to definition" trên `mediator.Send()` không ra handler — phải tìm bằng tay |

**Khi nào thì nên dùng:** team nhiều người cần chuẩn hóa cách viết; hoặc cần pipeline behavior áp cho hàng chục use case; hoặc thật sự tách read/write model (read từ replica, ghi vào primary).

**Cách trả lời phỏng vấn:**
> *"Em có tìm hiểu MediatR và CQRS. Nhưng dự án em một người làm, mỗi use case chỉ có một luồng đọc-ghi trên cùng entity, nên thêm MediatR chỉ tăng một tầng gián tiếp mà không giải quyết vấn đề nào. Cross-cutting concern như log và exception em xử lý bằng middleware. Nếu sau này cần transaction hay validation áp cho nhiều use case thì MediatR pipeline behavior sẽ đáng giá."*

---

### ✅ FluentValidation — validate đầu vào

**Là gì:** viết rule validate bằng code, tách khỏi DTO.

```csharp
public class RegisterValidator : AbstractValidator<RegisterRequest>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.TargetScore).InclusiveBetween(10, 990);
    }
}
```

**Dự án đang làm thay bằng gì — 3 lớp:**

| Lớp | Ở đâu | Ví dụ |
|---|---|---|
| Frontend | Zod + React Hook Form | `LoginPage`, `RegisterPage` — chặn sớm, báo lỗi ngay khi user gõ |
| Identity | `Program.cs` cấu hình `options.Password.*` | Độ dài, chữ hoa, ký tự đặc biệt |
| Service | Kiểm tra thủ công, trả `Result<T>.Failure(...)` | `TestSessionService.SaveAnswersAsync` — kiểm tra session thuộc user, đúng trạng thái, câu hỏi trong phạm vi |

**Điểm yếu của cách hiện tại (nên tự nhận trong phỏng vấn):** validate rải rác, không có chỗ tập trung; cùng một rule (điểm mục tiêu 10–990) có thể viết ở FE mà quên ở BE. FluentValidation sẽ gom về một chỗ. Đây là **điểm cải thiện có thật**, không phải điểm mạnh.

---

### 🗺️ Mapster — map Entity ↔ DTO

**Là gì:** tự copy field cùng tên giữa hai object.

```csharp
var dto = user.Adapt<UserDto>();   // thay vì gán tay từng field
```

**Dự án đang làm thay bằng gì:** khởi tạo DTO thủ công ngay trong Service. Ví dụ `TestSessionService.GetHistoryAsync` dựng `new TestSessionHistoryItem(...)` bằng tay.

**Đánh đổi — hai chiều đều đúng:**

| Map tay (đang dùng) | Mapster/AutoMapper |
|---|---|
| ✅ Nhìn là biết field nào từ đâu | ❌ Map ngầm, đổi tên field là im lặng thành `null` |
| ✅ Không tốn reflection lúc chạy | ✅ Ít code lặp khi DTO nhiều field |
| ❌ Dài dòng khi DTO có 15+ field | ✅ Một dòng |
| ✅ Compiler bắt lỗi khi đổi DTO | ❌ Lỗi chỉ lộ lúc chạy |

**Cách trả lời phỏng vấn:**
> *"DTO của em phần lớn dưới 10 field và nhiều chỗ cần biến đổi chứ không phải copy thuần — ví dụ `PartsFilter` lưu chuỗi `'1,2,5'` trong DB nhưng trả ra mảng `int[]`. Map tay giữ được sự rõ ràng và để compiler bắt lỗi khi em đổi DTO. Nếu DTO phình to hoặc lặp nhiều thì em sẽ cân nhắc Mapster."*

</details>

---

<details>
<summary>🔐 ASP.NET Identity + JWT</summary>

**ASP.NET Identity:** Framework quản lý user có sẵn trong .NET — hash password, role, claim, lockout, email confirmation. Không cần tự viết lại.

**JWT hoạt động:**
```
1. User login → server tạo JWT (chứa userId, role, expire 60 phút)
2. Mỗi request gửi kèm: Authorization: Bearer <token>
3. Server verify chữ ký JWT → xác thực, không cần query DB
4. Token hết hạn → dùng Refresh Token (30 ngày) để lấy JWT mới
```

**Refresh Token:** Lưu trong DB, dùng 1 lần duy nhất. Bị đánh cắp → revoke ngay.

</details>

---

<details>
<summary>📡 SignalR — Real-time ⬜ CHƯA LÀM</summary>

> ⚠️ **Chưa cài package, chưa có Hub nào trong code.** Đây là kế hoạch Day 43+.
> Đừng nói "dự án em có real-time" khi phỏng vấn — câu hỏi tiếp theo sẽ là "Hub em đặt ở đâu, xử lý reconnect thế nào".

**Là gì:** Thư viện .NET cho phép server chủ động đẩy dữ liệu xuống client (WebSocket).

**Dự kiến dùng cho:**
- **1v1 Challenge** — Điểm số cập nhật ngay khi đối thủ trả lời
- **AI Chatbot** — Stream từng chữ như ChatGPT
- **Thông báo** — Nhắc nhở lịch thi, badge mới

</details>

---

<details>
<summary>⏰ Hangfire — Background Jobs</summary>

**Là gì:** Thư viện chạy tác vụ nền / định kỳ **trong cùng process API**, không block HTTP request của user. Job được lưu vào SQL Server (bảng `Hangfire.*`) → restart app vẫn nhớ lịch.

**Package (API):** `Hangfire.AspNetCore` + `Hangfire.SqlServer` (cùng connection string `DefaultConnection`).

---

### Vì sao dùng Hangfire trong TOEIC Master Pro?

User bấm chuông chỉ **đăng ký nhắc** (ghi DB). Không gửi mail ngay lúc đó — vì mail phải gửi **~3 ngày trước ngày thi**. Việc quét + gửi mail để Hangfire làm theo lịch, không bắt request FE chờ.

```
[User bấm chuông]
    → POST /api/examschedule/{id}/reminder
    → INSERT UserExamReminders (EmailSent = false)
    → trả 200 ngay (nhanh)

[Hangfire mỗi ngày 00:30]
    → ExamReminderJob.RunAsync()
    → tìm EmailSent=false AND ExamDate = hôm nay+3
    → IEmailSender.SendAsync(...)
    → EmailSent = true
```

---

### Job đã có (Day 21) vs dự kiến sau

| Job | Cron | Status | Class / chỗ gọi |
|---|---|---|---|
| Email nhắc lịch thi | `30 0 * * *` (00:30 mỗi ngày) | ✅ Day 21 | `ExamReminderJob` → `IExamReminderService.ProcessDueRemindersAsync` |
| Streak checker | Mỗi ngày ~00:01 | ⬜ Chưa | Phase gamification |
| Email verify lúc đăng ký | Fire-and-forget | ⬜ Chưa | Hiện Auth vẫn in Console token |
| Xóa refresh token hết hạn | Mỗi ngày ~03:00 | ⬜ Chưa | — |

---

### File / đoạn code liên quan

| File | Vai trò |
|---|---|
| `API/Program.cs` | `AddHangfire` + `AddHangfireServer` + dashboard `/hangfire` + `RecurringJob.AddOrUpdate` |
| `API/Jobs/ExamReminderJob.cs` | Wrapper mỏng — Hangfire resolve DI rồi gọi service |
| `Application/.../IExamReminderService.cs` | Contract: Subscribe / Unsubscribe / ProcessDue / GetMyReminderIds |
| `Infrastructure/Services/ExamReminderService.cs` | Logic thật: query DB + gửi mail + đánh dấu `EmailSent` |
| `Infrastructure/Services/ConsoleEmailSender.cs` | Dev: in email ra **console** (chưa SMTP) |
| `Application/.../IEmailSender.cs` | Abstraction — sau này đổi MailKit/SendGrid không đụng job |
| `Domain/Entities/UserExamReminder.cs` | Bảng đăng ký nhắc (`EmailSent`) |
| `API/Controllers/ExamScheduleController.cs` | API chuông + `GET my-reminders` (không phải Hangfire) |
| `frontend/.../ExamSchedulePage.tsx` | UI chuông toggle — chỉ gọi API subscribe/unsubscribe |

---

### Cấu hình trong `Program.cs` (ý nghĩa từng phần)

1. **`AddHangfire` + `UseSqlServerStorage`** — lưu job/queue vào SQL; `PrepareSchemaIfNecessary = true` tự tạo bảng Hangfire lần đầu.
2. **`AddHangfireServer`** — worker trong process API, lấy job ra chạy.
3. **`UseHangfireDashboard("/hangfire")`** — UI Dev: `http://localhost:5191/hangfire` (Recurring → Trigger now để test).
4. **`RecurringJob.AddOrUpdate<ExamReminderJob>(...)`** — đăng ký cron; id job = `"exam-reminder-email"`.

**Cron 5 phần:** `phút giờ ngày tháng thứ` → `"30 0 * * *"` = 00:30 mỗi ngày. Thiếu phần → `ArgumentException`.

> ⚠️ Tab Dashboard mở sẽ poll `POST /hangfire/stats` mỗi ~2s → log “spam”. Đóng tab thì hết. Đó **không phải** job đang chạy.

---

### Logic gửi nhắc (`ProcessDueRemindersAsync`)

- `targetDate = UtcNow.Date.AddDays(3)` — phải có `.Date` để so khớp với `ExamDate.Date`.
- Điều kiện: `EmailSent == false` + lịch `IsActive` + `ExamDate.Date == targetDate`.
- Gửi xong → `EmailSent = true` (không gửi trùng).
- Dev: nhìn console `========== EMAIL ==========` — **không** vào Gmail.

---

### Note kỹ thuật

- Job class nên mỏng; business nằm trong Application/Infrastructure service (giữ Clean Architecture).
- Hangfire resolve **scoped** service (`ExamReminderJob`, `DbContext`) mỗi lần chạy — OK với `AddHangfireServer`.
- Dashboard Dev đang **không** khóa auth — production cần `DashboardOptions.Authorization` trước khi expose.
- Email thật (MailKit/SendGrid) = implement lại `IEmailSender`, đổi DI trong `Program.cs`, không sửa Hangfire.

</details>

---

<details>
<summary>🤖 Claude API (Anthropic) — AI Engine ⬜ CHƯA LÀM</summary>

> ⚠️ **Chưa tích hợp.** Không có `AIService`, không có API key trong config. Đây là kế hoạch Day 37–48.
> Đây là **điểm khác biệt** của sản phẩm nên rất đáng làm — nhưng chỉ nói ở thì tương lai.

**Là gì:** API của Anthropic cho phép gọi model Claude để xử lý ngôn ngữ tự nhiên.

| Tính năng | Prompt gửi đi | Kết quả |
|---|---|---|
| Giải thích đáp án | "Câu hỏi... Đáp án đúng: A. Tại sao?" | Giải thích song ngữ Việt-Anh |
| Tạo study plan | "User yếu Part 4, mục tiêu 800, còn 8 tuần." | JSON kế hoạch từng ngày |
| Chatbot | Lịch sử hội thoại + câu hỏi mới | Câu trả lời tiếp theo |
| Score prediction | "Lịch sử 6 lần thi: 620, 660, 680..." | Khoảng điểm ước tính |

**Tiết kiệm chi phí:** Cache response trong Redis 7 ngày — cùng 1 câu hỏi không gọi API lại.

</details>

---

<details>
<summary>🐳 Docker + Docker Compose</summary>

**Docker:** Đóng gói ứng dụng + môi trường vào "container" — chạy y hệt nhau trên mọi máy.

**Docker Compose:** Chạy nhiều container cùng lúc bằng 1 file `docker-compose.yml`.

```bash
docker compose up -d    # Khởi động SQL Server + Redis
docker compose down     # Tắt tất cả
docker compose logs -f  # Xem log real-time
docker compose ps       # Kiểm tra trạng thái container
```

> ⚠️ Docker chỉ chạy SQL Server engine. Vẫn phải chạy migrations để tạo tables.

</details>

---

<details>
<summary>⚡ Vite — Frontend Build Tool</summary>

**Là gì:** Công cụ tạo và chạy project frontend hiện đại. Làm 2 việc chính:
- **Dev server**: reload trình duyệt tức thì (~50ms) mỗi khi lưu file — gọi là HMR (Hot Module Replacement)
- **Build**: đóng gói toàn bộ code thành file tĩnh tối ưu để deploy

**Tại sao không dùng Create React App (CRA):**
| | CRA (cũ) | Vite (mới) |
|---|---|---|
| Khởi động dev server | 30–60 giây | 1–2 giây |
| Hot reload | Chậm (~3–5s) | Tức thì (~50ms) |
| Còn được maintain | ❌ Deprecated | ✅ Active |

**Cấu trúc project Vite:**
```
frontend/
  src/           ← code React
  public/        ← file tĩnh (favicon, ảnh không qua build)
  index.html     ← entry point (Vite đọc file này đầu tiên)
  vite.config.ts ← cấu hình alias, proxy...
  tsconfig.json  ← cấu hình TypeScript
```

**Lệnh hay dùng:**
```bash
npm run dev    # chạy dev server tại localhost:5173
npm run build  # build production → thư mục dist/
npm run preview # xem trước bản build
```

</details>

---

<details>
<summary>🎨 Tailwind CSS — Utility-First CSS Framework</summary>

**Là gì:** Framework CSS theo hướng "utility-first" — thay vì viết file `.css` riêng, bạn gắn class trực tiếp vào HTML/JSX.

**So sánh cách viết:**
```jsx
// Cách cũ — phải viết file CSS riêng
<button className="btn-primary">Login</button>
// btn-primary { background: blue; padding: 8px 16px; border-radius: 4px; }

// Tailwind — viết thẳng vào component
<button className="bg-blue-500 px-4 py-2 rounded text-white hover:bg-blue-600">
  Login
</button>
```

**Tại sao dùng:**
- Không phải đặt tên class (không còn `.card-wrapper-inner-container`)
- Tất cả style nằm cùng chỗ với JSX → dễ đọc, dễ sửa
- Build tự loại bỏ class không dùng → file CSS cuối rất nhỏ
- Consistent design system (spacing, color, typography theo scale cố định)

</details>

---

<details>
<summary>🧩 shadcn/ui — Component Library</summary>

**Là gì:** Bộ component UI đẹp sẵn (Button, Input, Card, Dialog, Table, Toast...) xây trên Tailwind CSS.

**Khác gì Material UI / Ant Design:**
| | Material UI / Ant Design | shadcn/ui |
|---|---|---|
| Cách dùng | Cài package, import component | **Copy code component vào project** |
| Tùy chỉnh | Khó, phải override theme | Dễ, sửa thẳng file component |
| Bundle size | To (toàn bộ thư viện) | Nhỏ (chỉ có component bạn dùng) |
| Phụ thuộc | Cao | Thấp — bạn sở hữu code |

**Cách dùng:**
```bash
npx shadcn@latest add button   # copy Button component vào src/components/ui/button.tsx
npx shadcn@latest add input    # copy Input component
npx shadcn@latest add card     # copy Card component
```

**Trong project này dùng cho:** Auth pages (Login, Register), Profile page, bảng câu hỏi, dialog xác nhận, toast thông báo, form nhập liệu.

</details>

---

<details>
<summary>📖 Swagger + Scalar — API Documentation</summary>

**Là gì:** Công cụ tự động sinh tài liệu và giao diện test API từ code controller — không cần viết tay.

**Tại sao cần:**
- Frontend cần biết API nhận gì, trả gì, cần token không → Swagger/Scalar sinh ra trang tài liệu tự động.
- Trong development: test API ngay trên trình duyệt mà không cần Postman.

**Swagger vs Scalar:**
| | Swagger UI | Scalar UI |
|---|---|---|
| Giao diện | Cũ, đơn giản | Hiện đại, đẹp hơn |
| Cùng nguồn dữ liệu | OpenAPI spec (`/swagger/v1/swagger.json`) | OpenAPI spec |
| URL | `/swagger` | `/scalar/v1` |

**JWT support:** Mặc định Swagger không biết project dùng JWT → phải cấu hình thêm `AddSecurityDefinition("Bearer")` → mới có nút **Authorize** để nhập token test endpoint `[Authorize]`.

> Chỉ bật trong `Development` — production không expose tài liệu API ra ngoài.

</details>

---

<details>
<summary>🌐 CORS — Cross-Origin Resource Sharing</summary>

**Là gì:** Cơ chế browser dùng để kiểm soát request từ một origin (domain:port) sang origin khác.

**Vấn đề:** Mặc định browser **chặn** mọi request từ `http://localhost:5173` (React) sang `https://localhost:7xxx` (API) vì khác origin — gọi là **Same-Origin Policy**.

**Lỗi nếu không cấu hình CORS:**
```
Access to fetch at 'https://localhost:7xxx/api/auth/login'
from origin 'http://localhost:5173' has been blocked by CORS policy.
```

**Giải pháp:** Server khai báo danh sách origin được phép → browser cho qua:
```json
"Cors": {
  "AllowedOrigins": [ "http://localhost:5173" ]
}
```

**Lưu ý quan trọng:**
- CORS phải đứng **trước** `UseAuthentication` trong pipeline.
- `AllowCredentials()` cần thiết khi frontend gửi cookie hoặc Authorization header.
- Production: thay `localhost:5173` bằng domain thật.

</details>

---

<details>
<summary>🌊 Serilog — Structured Logging</summary>

**Là gì:** Thư viện ghi nhật ký hoạt động của app — giống hộp đen máy bay. Khi user báo lỗi, mở log ra đọc thay vì đoán mò.

**Vấn đề nếu không có logging:**
> User báo "Tôi đăng nhập không được lúc 2 giờ sáng" → không biết lúc đó data là gì, không tái hiện được lỗi.

**Với Serilog, mở log ra thấy ngay:**
```
[ERR] 02:13:45 POST /api/auth/login → 400
      Email: "user@gmail.com"
      Error: "Email hoặc mật khẩu không đúng"
```

**Tại sao không dùng `ILogger` mặc định của .NET?**

| Tính năng | ILogger mặc định | Serilog |
|---|---|---|
| In ra console | ✅ | ✅ |
| Lưu ra file | ❌ | ✅ |
| Tự chia file theo ngày | ❌ | ✅ |
| Tự xóa log cũ (giữ 7 ngày) | ❌ | ✅ |
| Gửi lên cloud (Seq, Datadog) | ❌ | ✅ |
| Cấu hình qua appsettings.json | Hạn chế | ✅ |

**Trong project này Serilog làm gì:**

1. **Log mọi request HTTP** (nhờ `UseSerilogRequestLogging`):
```
[INF] GET  /api/profile/me     → 200  45ms
[INF] POST /api/auth/login     → 200  120ms
[WRN] POST /api/auth/login     → 400  30ms   ← login sai
[ERR] GET  /api/questions/999  → 500  5ms    ← crash
```

2. **Lưu log ra file theo ngày, tự xóa sau 7 ngày:**
```
logs/
  log-20260626.txt   ← hôm nay
  log-20260625.txt   ← hôm qua
  ...                ← tự xóa file cũ hơn 7 ngày
```

3. **Phân cấp mức độ:**
- `Information` — hoạt động bình thường
- `Warning` — đáng chú ý (login sai nhiều lần)
- `Error` — lỗi cần xử lý
- `Fatal` — app sắp sập

4. **Kết hợp với GlobalExceptionHandler:** Exception nào xảy ra, lúc mấy giờ, stack trace đầy đủ → nằm hết trong file log.

**Cấu hình qua `appsettings.json`** — không cần sửa code khi muốn thay đổi log level:
```json
"Serilog": {
  "MinimumLevel": { "Default": "Information" },
  "WriteTo": [
    { "Name": "Console" },
    { "Name": "File", "Args": { "path": "logs/log-.txt", "rollingInterval": "Day", "retainedFileCountLimit": 7 } }
  ]
}
```

**Sink:** Console (dev) → File (staging/prod) → Seq/Datadog (production lớn).

> 💡 **Câu thần chú:** Khi app chạy production, bạn không thể mở debugger. Log là **mắt** của bạn để quan sát app từ xa. Serilog thường là thứ **đầu tiên** bạn nhìn vào khi user báo bug.

</details>

---

<details>
<summary>🛣️ React Router DOM — Client-side Routing</summary>

**Là gì:** Thư viện điều hướng cho React — chuyển trang mà **không reload browser** (Single Page Application).

**So sánh:**
| | Web truyền thống | React Router |
|---|---|---|
| Chuyển trang | Browser reload, server trả HTML mới | JavaScript thay component, không reload |
| Tốc độ | Chậm hơn | Tức thì |
| URL | Thay đổi | Thay đổi (nhưng không gọi server) |

**Các khái niệm chính:**
```tsx
// BrowserRouter: bao toàn bộ app, kích hoạt routing
// Routes: container chứa các route
// Route: map URL → Component
// Link: thay thế <a href> — không reload trang
// useNavigate: chuyển trang bằng code (sau khi login xong → về Home)
// useParams: lấy tham số từ URL (vd: /questions/:id → params.id)
```

**Trong project:** Điều hướng giữa /login, /register, /forgot-password, /dashboard, /practice...

</details>

---

<details>
<summary>📡 Axios — HTTP Client</summary>

**Là gì:** Thư viện gọi API HTTP từ React đến backend .NET — thay thế `fetch` có nhiều tính năng hơn.

**Tại sao dùng thay `fetch` mặc định:**
| | fetch (built-in) | Axios |
|---|---|---|
| Tự động parse JSON | ❌ Phải `.json()` thủ công | ✅ |
| Interceptor (gắn token tự động) | ❌ | ✅ |
| Xử lý lỗi HTTP (4xx, 5xx) | ❌ Không throw error | ✅ Tự throw |
| Cancel request | Phức tạp | ✅ Đơn giản |

**Axios instance:** Tạo 1 instance dùng chung với base URL và header — không phải viết lại mỗi lần:
```ts
const api = axios.create({ baseURL: 'https://localhost:7xxx/api' })

// Interceptor: tự gắn JWT token vào mọi request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

</details>

---

<details>
<summary>📋 React Hook Form — Form Management</summary>

**Là gì:** Thư viện quản lý state của form trong React — thay thế việc dùng `useState` cho từng input.

**Vấn đề nếu không dùng:**
```tsx
// Không có React Hook Form — rất verbose
const [email, setEmail] = useState('')
const [password, setPassword] = useState('')
const [emailError, setEmailError] = useState('')
// ... mỗi field cần 2-3 state, 1 form 5 field = 15+ state
```

**Với React Hook Form:**
```tsx
const { register, handleSubmit, formState: { errors } } = useForm()

// register("email") = gắn field vào form (theo dõi value + validation)
<input {...register("email", { required: "Email là bắt buộc" })} />
{errors.email && <span>{errors.email.message}</span>}
```

**Ưu điểm lớn:** Chỉ re-render component khi submit, không re-render khi gõ từng chữ → hiệu năng cao.

</details>

---

<details>
<summary>🛡️ Zod — Schema Validation</summary>

**Là gì:** Thư viện định nghĩa "schema" (quy tắc) cho dữ liệu — validate form, API response, config...

**Cách dùng:**
```ts
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
})

// TypeScript tự suy ra type từ schema — không phải viết interface riêng
type LoginForm = z.infer<typeof loginSchema>
// → { email: string; password: string }
```

**Kết hợp với React Hook Form qua `@hookform/resolvers`:**
```tsx
const { register, handleSubmit } = useForm<LoginForm>({
  resolver: zodResolver(loginSchema),  // Zod validate tự động khi submit
})
```

**Tại sao không dùng validation của React Hook Form thôi?** Zod cho phép tái sử dụng schema ở nhiều chỗ (form + API type + server validation), và dễ đọc hơn khi rule phức tạp.

</details>

---

<details>
<summary>🐻 Zustand — Global State Management</summary>

**Là gì:** Thư viện quản lý state toàn app (global state) — nhẹ, đơn giản, không cần boilerplate như Redux.

**Vấn đề nếu không có Zustand:**
```tsx
// Mỗi component muốn biết user là ai phải tự đọc localStorage
const email = localStorage.getItem('userEmail') // lặp khắp nơi
// Khi logout, phải tìm và clear từng component một
```

**Với Zustand — một store duy nhất, mọi component subscribe:**
```tsx
// Khai báo store
export const useAuthStore = create((set) => ({
  user: null,
  loginSuccess: (user) => set({ user, isAuthenticated: true }),
  logout: () => { clearTokens(); set({ user: null, isAuthenticated: false }) },
}))

// Dùng ở bất kỳ component nào — tự động re-render khi user thay đổi
const user = useAuthStore(state => state.user)
const logout = useAuthStore(state => state.logout)
```

**Tại sao không dùng React Context?**
| | React Context | Zustand |
|---|---|---|
| Re-render khi state thay đổi | Toàn bộ cây component | Chỉ component dùng field đó |
| Boilerplate | Provider + useContext mỗi lần | Chỉ `create()` một lần |
| Persist (lưu localStorage) | Tự viết | `persist` middleware có sẵn |

**`persist` middleware:** Tự động sync state vào localStorage — refresh trang không mất trạng thái login.

**Trong project này dùng cho:** Auth state (user, isAuthenticated), sau này có thể dùng cho theme, notification settings.

</details>

---

<details>
<summary>🔑 @react-oauth/google — Google OAuth</summary>

**Là gì:** Thư viện chính thức của Google để tích hợp Google Sign-In vào React app.

**Flow hoạt động:**
```
1. User nhấn nút "Đăng nhập với Google"
2. Google popup xuất hiện → user chọn tài khoản
3. Google cấp idToken cho frontend (chứng minh user là ai)
4. Frontend gửi idToken lên backend: POST /api/auth/google-login
5. Backend xác thực idToken với Google API
6. Backend tạo JWT của hệ thống → trả về accessToken + refreshToken
7. Frontend lưu token → đăng nhập thành công
```

**Tại sao không tự làm OAuth flow?** OAuth 2.0 có nhiều bước phức tạp (PKCE, state parameter, token exchange...). Thư viện này xử lý toàn bộ, chỉ cần nhận `credential` (idToken) trong callback.

**Cần thiết lập trước:**
- Tạo project trên Google Cloud Console
- Đăng ký `Client ID` → khai báo origin được phép (`localhost:5173`)
- Lưu `VITE_GOOGLE_CLIENT_ID` vào `.env`

**Cách dùng:**
```tsx
// main.tsx — bọc toàn app
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>

// LoginPage — component button Google
<GoogleLogin
  onSuccess={(res) => {
    // res.credential = idToken → gửi lên backend
    authService.googleLogin(res.credential)
  }}
  onError={() => setError('Đăng nhập Google thất bại')}
/>
```

</details>

---

<details>
<summary>📊 EPPlus — Đọc/ghi file Excel (.xlsx)</summary>

**Là gì:** Thư viện .NET để đọc và ghi file Excel `.xlsx` mà không cần cài Microsoft Office.

**Tại sao dùng:**
- Content Manager cần import hàng trăm câu hỏi từ file Excel một lúc — gọi API từng câu sẽ mất hàng giờ.
- EPPlus cho phép đọc toàn bộ sheet, validate từng hàng, rồi insert vào DB trong 1 request duy nhất.

**Cài đặt** (vào Infrastructure project):
```bash
dotnet add package EPPlus --version 7.6.1
```

**Lưu ý license:** EPPlus v5+ yêu cầu khai báo license context trước khi dùng. Dự án này dùng miễn phí (non-commercial):
```csharp
ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
```

**Cách dùng cơ bản:**
```csharp
using var package = new ExcelPackage(fileStream);
var sheet = package.Workbook.Worksheets[0];  // lấy sheet đầu tiên
var rowCount = sheet.Dimension?.Rows ?? 0;

for (int row = 2; row <= rowCount; row++)    // row 1 = header
{
    var content = sheet.Cells[row, 3].GetValue<string>();
    var part    = sheet.Cells[row, 1].GetValue<int>();
}
```

**Trong project này dùng cho:** `POST /api/question/import` — CM upload file `.xlsx` chứa danh sách câu hỏi, backend parse + validate từng hàng + insert hàng loạt vào DB, trả về báo cáo (thành công/lỗi theo từng hàng).

</details>

---

<details>
<summary>✍️ TipTap — Rich Text Editor</summary>

**Là gì:** Thư viện rich text editor headless cho React — cho phép soạn thảo văn bản có định dạng (bold, italic, danh sách...) trong trình duyệt, tương tự Google Docs thu nhỏ.

**Tại sao "headless":** TipTap không có giao diện sẵn — bạn tự xây toolbar và styling theo thiết kế của mình. Ngược lại với các editor như Quill hay CKEditor có giao diện cứng khó tùy chỉnh.

**Cài đặt:**
```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit
```

- `@tiptap/react` — React binding
- `@tiptap/pm` — ProseMirror core (engine bên dưới)
- `@tiptap/starter-kit` — gói extension cơ bản (Bold, Italic, BulletList, Heading...)

**Cách dùng cơ bản:**
```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

const editor = useEditor({
  extensions: [StarterKit],
  content: '<p>Nội dung ban đầu</p>',
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()  // lấy HTML để lưu vào DB
  },
})

// editor.getHTML()  → "<p><strong>Câu hỏi</strong></p>"
// editor.getText()  → "Câu hỏi" (không có tag)
```

**Tại sao lưu HTML:** Nội dung câu hỏi TOEIC có thể có bold/italic/danh sách → cần lưu HTML để render đúng. Khi hiển thị dùng `dangerouslySetInnerHTML={{ __html: content }}`.

**Trong project này dùng cho:** Form tạo/sửa câu hỏi — soạn nội dung câu hỏi, giải thích đáp án, passage (đoạn văn Part 6–7) có rich text thay vì plain text.

</details>

---

<details>
<summary>📈 Recharts — Biểu đồ (React Charts)</summary>

**Là gì:** Thư viện vẽ biểu đồ **dành cho React** — component declarative (`LineChart`, `BarChart`…), render SVG, lõi dựa trên **D3**. Package npm: `recharts` (project: `^3.10`).

**Không phải:** Thư viện vanilla JS hay chart server-side — **chỉ dùng trong frontend React** (cùng stack Vite + TypeScript).

**Tại sao dùng:** API quen với React, responsive (`ResponsiveContainer`), tooltip/legend tích hợp, không cần tự bọc D3 thủ công.

**Trong project này dùng cho:**

| Trang | Biểu đồ | API / dữ liệu |
|---|---|---|
| `/mock-test/progress` (Day 31) | **Bar chart** — best score / đề | `GET /api/test-session/stats/by-test` |
| `/dashboard` (Day 32) | **Line chart** — điểm theo thời gian | `GET /api/test-session/stats/timeline` |

**Không dùng Recharts cho:** Phân tích Part (`ExamPartBreakdownPanel`) — thanh % bằng **CSS/Tailwind** (đủ cho 7 Part, nhẹ hơn).

**Ví dụ tối thiểu (line chart):**
```tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

<ResponsiveContainer width="100%" height={300}>
  <LineChart data={[{ label: '01/07', score: 650 }, { label: '15/07', score: 720 }]}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="label" />
    <YAxis domain={[0, 990]} />
    <Tooltip />
    <Line type="monotone" dataKey="score" stroke="#1a4d7c" />
  </LineChart>
</ResponsiveContainer>
```

**File tham chiếu:** `frontend/src/pages/TestProgressPage.tsx`, `frontend/src/pages/DashboardPage.tsx`.

</details>

---

<details>
<summary>🔔 Sonner — Toast Notifications</summary>

**Là gì:** Thư viện hiển thị thông báo tạm thời (toast) góc màn hình — thay thế `alert()` của trình duyệt bằng UI đẹp, chuyên nghiệp hơn.

**Tại sao không dùng `alert()`:**
| | `alert()` | Sonner |
|---|---|---|
| Giao diện | Popup xấu của hệ điều hành | Toast đẹp, có animation |
| Block UI | ✅ Chặn toàn bộ trang | ❌ Không block |
| Tự đóng | ❌ Phải bấm OK | ✅ Tự đóng sau vài giây |
| Customize | ❌ | ✅ màu sắc, icon, duration |

**Cách dùng:**
```tsx
import { toast } from 'sonner'

toast.success('Tạo câu hỏi thành công!')   // toast xanh lá
toast.error('Có lỗi xảy ra!')              // toast đỏ
toast.warning('Cảnh báo!')                 // toast vàng
toast('Thông báo thường')                  // toast xám
```

**Cài đặt qua shadcn:**
```bash
npx shadcn@latest add sonner
```

Sau đó đặt `<Toaster />` một lần duy nhất ở `App.tsx` — mọi `toast()` trong toàn app đều hiển thị qua đó.

**Trong project này dùng cho:** Thông báo tạo/sửa/xóa thành công hay thất bại ở các trang CM Dashboard (đề thi, câu hỏi).

</details>
