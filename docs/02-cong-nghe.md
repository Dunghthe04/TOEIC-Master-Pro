# Công nghệ sử dụng

<details>
<summary>📋 Bảng tổng hợp stack</summary>

### Backend
| Layer | Công nghệ |
|---|---|
| Framework | ASP.NET Core 8 (Web API) |
| ORM | Entity Framework Core 8 |
| Database | SQL Server 2022 |
| Cache | Redis (StackExchange.Redis) |
| Auth | ASP.NET Identity + JWT + Refresh Token |
| Real-time | SignalR |
| Background Jobs | Hangfire |
| AI | Claude API (Anthropic) |
| File Storage | Azure Blob Storage / MinIO (local dev) |
| Email | MailKit + SendGrid |
| Logging | Serilog |
| API Docs | Scalar |

### Frontend
| Layer | Công nghệ |
|---|---|
| Framework | React 18 + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| State | Zustand |
| Data Fetching | TanStack Query |
| Audio | Howler.js |
| Charts | Recharts |
| Rich Text | TipTap (content manager) |

### DevOps
| Item | Công nghệ |
|---|---|
| Container | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Reverse Proxy | Nginx |
| Hosting | VPS (Ubuntu) hoặc Azure App Service |
| Monitoring | Grafana + Prometheus |

</details>

---

<details>
<summary>🗄️ SQL Server 2022 — Database chính</summary>

**Là gì:** Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) của Microsoft.

**Tại sao dùng:** Tích hợp tốt nhất với .NET/EF Core, hỗ trợ JSON columns, Full-text search cho tìm kiếm câu hỏi, transaction mạnh cho việc chấm bài thi.

**Dùng để lưu:** Toàn bộ dữ liệu chính — users, câu hỏi, đề thi, kết quả, từ vựng, lịch thi, bình luận.

**Trong Docker:** Chạy ở `localhost:1433`, tài khoản `sa`, password trong `.env`.

> ⚠️ Docker chỉ cung cấp SQL Server engine (phần mềm). Muốn có tables thì phải chạy EF Core Migrations.

</details>

---

<details>
<summary>⚡ Redis — Cache & Real-time Data</summary>

**Là gì:** Cơ sở dữ liệu in-memory (lưu trong RAM) dạng key-value, cực kỳ nhanh (~0.1ms so với ~5ms của SQL Server).

**Tại sao dùng:** Những dữ liệu đọc nhiều, viết ít thì cache vào Redis thay vì query SQL Server mỗi lần → giảm tải DB, tăng tốc response.

**Dùng để:**
| Mục đích | Ví dụ cụ thể |
|---|---|
| Cache AI response | Giải thích câu hỏi đã có → cache 7 ngày, lần sau không gọi API lại |
| JWT Blacklist | Token bị logout → lưu vào Redis đến hết expire |
| Rate limiting | Đếm số lần gọi API của từng user trong 1 phút |
| Leaderboard | `ZADD leaderboard 2450 userId` → `ZRANGE` lấy top 10 tức thì |
| Session thi thử | Lưu trạng thái bài đang làm tránh mất dữ liệu |

**Trong Docker:** Chạy ở `localhost:6379`. Tool xem dữ liệu: **RedisInsight** (GUI miễn phí).

</details>

---

<details>
<summary>🔀 MediatR — CQRS Pattern</summary>

**Là gì:** Thư viện implement Mediator pattern — Controller gửi "request", MediatR tìm đúng "handler" xử lý, tách biệt hoàn toàn HTTP layer với business logic.

**CQRS = Command Query Responsibility Segregation:**
```
Command  = thay đổi dữ liệu  → SubmitTestCommand, RegisterCommand
Query    = chỉ đọc dữ liệu   → GetTestByIdQuery, GetLeaderboardQuery
```

**Luồng thực tế:**
```
POST /api/tests/submit
  → Controller.Submit()
  → mediator.Send(new SubmitTestCommand(...))
  → SubmitTestCommandHandler.Handle()   ← MediatR tìm đúng handler
  → return TestResultDto
```

</details>

---

<details>
<summary>✅ FluentValidation — Validate Input</summary>

**Là gì:** Thư viện validate dữ liệu đầu vào bằng rules viết bằng code, tự động chạy qua MediatR Pipeline trước khi vào Handler.

**Ví dụ:**
```csharp
public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).MinimumLength(8).Matches("[A-Z]").Matches("[0-9]");
        RuleFor(x => x.TargetScore).InclusiveBetween(10, 990);
    }
}
// Nếu sai → tự động trả 400 Bad Request, không vào Handler
```

</details>

---

<details>
<summary>🗺️ Mapster — Object Mapping</summary>

**Là gì:** Thư viện tự động copy dữ liệu từ object này sang object khác (Entity → DTO).

**Tại sao dùng thay AutoMapper:** Nhanh hơn 2-3x, ít cấu hình hơn, không có lỗ hổng bảo mật như AutoMapper 13.

```csharp
// Không có Mapster — viết tay từng field
var dto = new UserDto { Id = user.Id, Email = user.Email, Name = user.FullName };

// Dùng Mapster — tự động map field cùng tên
var dto = user.Adapt<UserDto>();
```

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
<summary>📡 SignalR — Real-time</summary>

**Là gì:** Thư viện .NET cho phép server chủ động đẩy dữ liệu xuống client (WebSocket).

**Dùng cho:**
- **1v1 Challenge** — Điểm số cập nhật ngay khi đối thủ trả lời
- **AI Chatbot** — Stream từng chữ như ChatGPT
- **Thông báo** — Nhắc nhở lịch thi, badge mới

</details>

---

<details>
<summary>⏰ Hangfire — Background Jobs</summary>

**Là gì:** Thư viện chạy tác vụ nền và tác vụ định kỳ (không block request của user).

| Job | Tần suất | Làm gì |
|---|---|---|
| Streak checker | Mỗi ngày 00:01 | Kiểm tra user không học → reset streak |
| Email nhắc lịch thi | 3 ngày trước | Gửi email tới user đã đặt nhắc |
| Gửi email verify | Ngay khi đăng ký | Không block request đăng ký |
| Xóa expired token | Mỗi ngày 03:00 | Xóa refresh token hết hạn trong DB |

</details>

---

<details>
<summary>🤖 Claude API (Anthropic) — AI Engine</summary>

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
