# Clean Architecture

Dự án áp dụng **Clean Architecture** — tổ chức code thành các lớp đồng tâm, lớp trong không biết gì về lớp ngoài. Business logic độc lập với framework, database, UI.

```
        ┌─────────────────────────────────┐
        │           API Layer             │  ← Lớp ngoài cùng
        │   (Controllers, Middleware)     │
        └──────────────┬──────────────────┘
                       │ gọi
        ┌──────────────▼──────────────────┐
        │       Application Layer         │
        │  (Use Cases, DTOs, Validators)  │
        └──────────────┬──────────────────┘
                       │ gọi interface
        ┌──────────────▼──────────────────┐
        │         Domain Layer            │  ← Lớp trong cùng, KHÔNG phụ thuộc ai
        │   (Entities, Business Rules)    │
        └─────────────────────────────────┘
                       ▲
                       │ implement interface
        ┌──────────────┴──────────────────┐
        │      Infrastructure Layer       │
        │  (EF Core, Redis, Email, AI)    │
        └─────────────────────────────────┘
```

**Quy tắc vàng:** Mũi tên chỉ đi từ ngoài vào trong. `Infrastructure` implement các interface mà `Domain`/`Application` định nghĩa — không bao giờ ngược lại.

---

<details>
<summary>🔵 Layer 1 — Domain <code>ToeicMasterPro.Domain</code></summary>

**Là gì:** Trái tim của ứng dụng. Chứa business logic thuần túy, không import bất kỳ thư viện nào ngoài .NET base class.

**Cấu trúc thật (đối chiếu code 2026-07-26):**
```
Domain/
├── Entities/           ← 12 entity: ApplicationUser, Question, QuestionOption,
│                          Test, TestQuestion, TestSession, TestSessionAnswer,
│                          Vocabulary, UserVocabulary, ExamSchedule,
│                          UserExamReminder, RefreshToken
├── Enums/              ← QuestionPart, DifficultyLevel, TestSessionStatus...
└── Common/
    ├── BaseEntity.cs   ← Id, CreatedAt, UpdatedAt + SetUpdatedAt()
    └── Result.cs       ← Wrapper thành công/thất bại, thay vì throw Exception
```

**Ví dụ thật — `Domain/Entities/Question.cs`:**
```csharp
public class Question : BaseEntity
{
    public string Content { get; set; } = string.Empty;
    public QuestionPart Part { get; set; }
    public DifficultyLevel Difficulty { get; set; }
    public string? Explanation { get; set; }
    // ... property thuần, không có logic
}
```

> ⚠️ **Điểm cần biết trước khi phỏng vấn — Anemic Domain Model**
>
> Entity của dự án chỉ là **túi đựng dữ liệu**: property `public get; set;`, không có factory method,
> không tự bảo vệ trạng thái hợp lệ. Toàn bộ nghiệp vụ (chấm điểm, kiểm tra quyền, chuyển trạng thái
> phiên thi) nằm ở tầng Service trong Infrastructure.
>
> Kiểu này gọi là **Anemic Domain Model** — Martin Fowler coi là anti-pattern, nhưng nó là cách
> **phổ biến nhất** trong thế giới .NET thực tế và hoàn toàn bảo vệ được.
>
> **Nếu bị hỏi "Domain của em có business logic không?":**
> > *"Domain em hiện là anemic model — entity chỉ giữ dữ liệu, nghiệp vụ nằm ở Service. Em chọn vậy vì
> > phần lớn nghiệp vụ của em là điều phối nhiều entity cùng lúc (chấm một phiên thi phải đọc
> > TestSession + TestQuestion + Question + QuestionOption), đặt vào một entity đơn lẻ sẽ không tự nhiên.
> > Đổi lại, entity không tự bảo vệ được trạng thái — ví dụ ai cũng gán `session.Status = Completed`
> > mà không qua kiểm tra. Nếu làm lại, chỗ đáng chuyển sang rich model nhất là `TestSession`,
> > cho nó method `Complete(score)` tự kiểm tra trạng thái trước khi đổi."*
>
> Trả lời được như trên = hiểu đánh đổi. Nói "dạ Domain em chứa business logic" = sai với code của chính mình.

> ❌ Layer này KHÔNG import `Microsoft.EntityFrameworkCore`, `Microsoft.AspNetCore`, hay bất kỳ package ngoài nào — điều này thì code đang làm đúng.

</details>

---

<details>
<summary>🟢 Layer 2 — Application <code>ToeicMasterPro.Application</code></summary>

**Là gì:** Lớp điều phối — định nghĩa *ứng dụng có thể làm gì* (use cases). Biết Domain, không biết Infrastructure hay API.

**Cấu trúc thật (đối chiếu code 2026-07-26):**
```
Application/
├── Common/
│   ├── Interfaces/       ← 17 interface — contract cho Infrastructure implement
│   │   ├── IRepository.cs, IUnitOfWork.cs
│   │   ├── IAuthService.cs, ITokenService.cs, ICurrentUserService.cs
│   │   ├── ITestSessionService.cs, ITestService.cs, IQuestionService.cs
│   │   ├── ICacheService.cs, IEmailSender.cs
│   │   └── ...
│   ├── Options/          ← JwtSettings, GoogleAuthSettings, ToeicDirectionsOptions
│   ├── ToeicScoreHelper.cs        ← Quy đổi điểm ETS (nghiệp vụ thuần, có unit test)
│   ├── ToeicEtsConversionTable.cs ← Bảng tra WIE
│   └── PartBreakdownBuilder.cs    ← Gom thống kê theo Part
└── DTOs/                 ← Gom theo nhóm nghiệp vụ, KHÔNG theo Command/Query
    ├── Auth/  ExamSchedules/  Practice/  Profile/
    ├── Questions/  Srs/  Tests/  TestSessions/  Vocabularies/
```

> 🔴 **Doc cũ mô tả sai** — từng ghi có `Features/Auth/Commands/`, `Common/Behaviors/` (MediatR pipeline).
> Những thư mục đó **tồn tại nhưng rỗng**, tạo từ ngày đầu theo tutorial rồi bỏ. Đã xóa ngày 2026-07-26.
> Dự án **không dùng CQRS/MediatR** — xem mục lý do trong [02-cong-nghe.md](02-cong-nghe.md).

**Điểm đáng chú ý:** Application chứa **interface + DTO + nghiệp vụ thuần**, không chứa implement service.
Ví dụ nghiệp vụ thuần đáng kể nhất là `ToeicScoreHelper` — quy đổi số câu đúng sang thang điểm ETS.
Nó không cần DB, không cần HTTP, nên **test được bằng unit test thuần** (`ToeicMasterPro.Tests`).
Đây là ví dụ tốt nhất trong dự án về "tách nghiệp vụ khỏi hạ tầng" — rất đáng đem ra kể khi phỏng vấn.

**Ví dụ thật — cách một use case được khai báo:**
```csharp
// Application/Common/Interfaces/ITestSessionService.cs
public interface ITestSessionService
{
    Task<Result<TestSessionStartedResponse>> StartAsync(Guid userId, StartTestSessionRequest req);
    Task<Result<int>> SaveAnswersAsync(Guid userId, Guid sessionId, SaveSessionAnswersRequest req);
    Task<Result<TestSessionSubmitResponse>> SubmitAsync(Guid userId, Guid sessionId);
    // ...
}
```
Application chỉ nói **"làm được gì"**. Việc **"làm thế nào"** nằm ở Infrastructure.
Đây chính là Dependency Inversion — tầng trong định nghĩa contract, tầng ngoài implement.

</details>

---

<details>
<summary>🟠 Layer 3 — Infrastructure <code>ToeicMasterPro.Infrastructure</code></summary>

**Là gì:** Lớp kỹ thuật — implement các interface mà Application định nghĩa. Biết tất cả về DB, cache, AI nhưng không biết business logic.

**Cấu trúc thật (đối chiếu code 2026-07-26):**
```
Infrastructure/
├── Persistence/
│   ├── ApplicationDbContext.cs      ← EF Core DbContext (kế thừa IdentityDbContext)
│   ├── Configurations/              ← Cấu hình bảng bằng Fluent API
│   └── Repositories/
│       ├── Repository.cs            ← Repository<T> generic
│       └── UnitOfWork.cs
├── Migrations/                      ← ⚠️ nằm ở đây, KHÔNG phải Persistence/Migrations
├── Authentication/                  ← TokenService (tạo/verify JWT)
├── Caching/                         ← RedisCacheService : ICacheService
└── Services/                        ← Nơi chứa TOÀN BỘ nghiệp vụ
    ├── TestSessionService.cs        ← lớn nhất: chấm điểm, lịch sử, dashboard
    ├── AuthService.cs, ProfileService.cs
    ├── TestService.cs, QuestionService.cs, PracticeService.cs
    ├── ExamScheduleService.cs, ExamReminderService.cs
    ├── SrsService.cs, VocabularyService.cs
    └── ConsoleEmailSender.cs        ← Dev: in email ra console
```

> 🔴 **Doc cũ mô tả sai** — từng ghi có `Services/AI/ClaudeAiService.cs` và
> `Services/Email/SendGridEmailService.cs`. Cả hai **chưa tồn tại**; các thư mục `AI/`, `Cache/`, `Email/`
> rỗng và đã xóa. Email hiện dùng `ConsoleEmailSender` (chỉ in ra console).
>
> Cũng **không có** `DependencyInjection.cs` — mọi service đăng ký thẳng trong `API/Program.cs`.

> 💡 **Câu hỏi phỏng vấn hay gặp:** *"Business logic của em nằm ở tầng nào?"*
> Trả lời trung thực: **Infrastructure**. Theo Clean Architecture "chuẩn sách vở" thì nghiệp vụ nên ở
> Application/Domain, còn Infrastructure chỉ lo kỹ thuật. Dự án này đặt service ở Infrastructure vì
> service cần truy cập `IUnitOfWork`/EF Core trực tiếp.
> **Đánh đổi:** đổi ORM thì phải viết lại service. **Cách đúng hơn:** để implement service ở Application,
> chỉ `Repository`/`DbContext` ở Infrastructure. Biết và nói ra được điểm này = hiểu kiến trúc thật sự,
> không phải chỉ chép cấu trúc thư mục.

**Ví dụ — Redis Cache:**
```csharp
public class RedisCacheService : ICacheService  // implement interface từ Application
{
    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _redis.StringGetAsync(key);
        return value.HasValue ? JsonSerializer.Deserialize<T>(value!) : default;
    }

    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);
        await _redis.StringSetAsync(key, json, expiry ?? TimeSpan.FromMinutes(30));
    }
}
```

</details>

---

<details>
<summary>🔴 Layer 4 — API <code>ToeicMasterPro.API</code></summary>

**Là gì:** Entry point. Nhận HTTP request, gọi service qua interface, trả response. Không chứa business logic.

**Cấu trúc thật (đối chiếu code 2026-07-26):**
```
API/
├── Controllers/                 ← 10 controller
│   ├── AuthController.cs        ← register / login / google-login / refresh
│   ├── TestSessionController.cs ← start / answers / submit / history / dashboard
│   ├── TestController.cs, QuestionController.cs, MediaController.cs
│   ├── PracticeController.cs, SrsController.cs, VocabularyController.cs
│   ├── ProfileController.cs, ExamScheduleController.cs
├── Middleware/
│   └── GlobalExceptionHandler.cs  ← IExceptionHandler → ProblemDetails (RFC 7807)
├── Services/
│   └── CurrentUserService.cs      ← Đọc userId/role từ JWT claims
├── Jobs/
│   └── ExamReminderJob.cs         ← Wrapper mỏng cho Hangfire
├── wwwroot/uploads/               ← Audio + ảnh của đề thi (lưu trên đĩa)
├── Program.cs                     ← DI, middleware pipeline, CORS, seed role
└── appsettings.json
```

**Controller thật — gọn, không có logic:**
```csharp
// API/Controllers/TestSessionController.cs
[HttpPost("{id:Guid}/submit")]
public async Task<IActionResult> Submit(Guid id)
{
    var userId = RequireUserId();               // lấy từ JWT qua ICurrentUserService
    if (userId is null) return Unauthorized();

    var result = await _service.SubmitAsync(userId.Value, id);
    return result.IsSuccess
        ? Ok(result.Value)
        : BadRequest(new { error = result.Error });
}
```

> 💡 **Vì sao trả `Result<T>` thay vì `throw Exception`:** lỗi nghiệp vụ (phiên thi đã nộp rồi, đề chưa
> publish) là **kết quả bình thường** của luồng, không phải sự cố. Dùng exception cho việc này vừa chậm
> (exception trong .NET tốn kém), vừa khiến signature hàm nói dối — nhìn `Task<TestResultDto>` tưởng
> luôn thành công. `Result<T>` bắt người gọi phải xử lý nhánh thất bại. Exception để dành cho sự cố thật
> (mất kết nối DB) và do `GlobalExceptionHandler` bắt.

</details>

---

<details>
<summary>🔄 Luồng xử lý một request hoàn chỉnh</summary>

> ⭐ **Đây là câu phỏng vấn gần như chắc chắn bị hỏi:** *"Kể anh nghe một request đi qua những đâu."*
> Sơ đồ dưới lấy đúng theo thứ tự middleware trong `Program.cs` — học thuộc thứ tự này.

```
HTTP POST /api/test-session/{id}/submit     Authorization: Bearer <JWT>
         │
         ▼
  UseExceptionHandler()            ← ngoài cùng, bọc tất cả. Có exception lọt ra
         │                            → GlobalExceptionHandler → ProblemDetails (RFC 7807)
         ▼
  UseSerilogRequestLogging()       ← ghi log: method, path, status, thời gian
         │
         ▼
  UseHttpsRedirection()            ← chỉ bật khi KHÔNG phải Development
         │
         ▼
  UseStaticFiles()                 ← nếu path là /uploads/... thì trả file luôn, DỪNG ở đây
         │
         ▼
  UseCors("Frontend")              ← kiểm tra Origin có trong whitelist không
         │
         ▼
  UseAuthentication()              ← đọc Bearer token, verify chữ ký + hạn
         │                            → dựng HttpContext.User (chưa phân quyền)
         ▼
  UseRateLimiter()                 ← policy "auth": 5 request/phút/IP
         │
         ▼
  UseAuthorization()               ← xét [Authorize] / [Authorize(Roles="...")]
         │                            → sai role thì 403 tại đây, chưa vào controller
         ▼
  MapControllers() → TestSessionController.Submit(id)
         │
         ├─ ICurrentUserService.UserId       ← đọc claim từ HttpContext.User
         ▼
  ITestSessionService.SubmitAsync(userId, sessionId)      [Application: interface]
         │
         ▼
  TestSessionService.SubmitAsync(...)                      [Infrastructure: implement]
         │
         ├── IUnitOfWork.Repository<TestSession>()  → EF Core → SQL Server
         ├── IUnitOfWork.Repository<Question>()     → EF Core → SQL Server
         ├── ToeicScoreHelper.ConvertSectionScore() → [Application: nghiệp vụ thuần, không I/O]
         ├── PartBreakdownBuilder.Build()           → [Application: nghiệp vụ thuần]
         └── IUnitOfWork.SaveChangesAsync()         → COMMIT
         │
         ▼
  Result<TestSessionSubmitResponse>
         │
         ▼
  200 OK { totalScore: 745, listeningScore: 390, readingScore: 355, partBreakdown: [...] }
```

### Ba câu hỏi đào sâu hay đi kèm sơ đồ này

**1. "Vì sao `UseCors` phải đứng trước `UseAuthentication`?"**
> Trình duyệt gửi **preflight request** `OPTIONS` trước request thật, và preflight **không mang** header
> `Authorization`. Nếu Authentication chạy trước, preflight bị trả 401 → trình duyệt kết luận CORS thất bại
> → request thật không bao giờ được gửi. Đặt CORS trước để preflight được trả lời sớm.

**2. "Khác nhau giữa `UseAuthentication` và `UseAuthorization`?"**
> `Authentication` = **anh là ai** — đọc token, verify chữ ký, dựng `HttpContext.User`. Không quyết định
> cho phép hay không.
> `Authorization` = **anh được làm gì** — dựa vào `HttpContext.User` để xét `[Authorize(Roles="Admin")]`.
> Vì thế thứ tự bắt buộc là Authentication trước. Sai thứ tự thì `User` luôn rỗng → mọi request 401.

**3. "`UseExceptionHandler` sao lại đặt ngoài cùng?"**
> Middleware là các lớp bọc nhau như củ hành. Đặt ngoài cùng thì mới bắt được exception ném ra từ **mọi**
> lớp bên trong. Đặt sau `UseAuthorization` thì exception xảy ra trong Authentication sẽ lọt ra ngoài,
> client nhận HTML lỗi mặc định của Kestrel thay vì JSON chuẩn.

</details>

---

<details>
<summary>🗃️ EF Core Migrations — Hướng dẫn sử dụng</summary>

**Migrations là gì:** Cơ chế EF Core tự động tạo SQL script khi thay đổi Entity class, giúp schema DB luôn đồng bộ với code mà không cần viết SQL thủ công.

**Cài dotnet-ef tool (1 lần duy nhất):**
```bash
dotnet tool install --global dotnet-ef
```

**Tạo migration mới** (chạy từ `d:\TOEIC_PROJECT`):
```bash
dotnet ef migrations add <TenMigration> \
  --project backend/ToeicMasterPro.Infrastructure \
  --startup-project backend/ToeicMasterPro.API

# Ví dụ:
dotnet ef migrations add InitialCreate ...
dotnet ef migrations add AddExamScheduleTable ...
```

**Áp dụng lên database:**
```bash
dotnet ef database update \
  --project backend/ToeicMasterPro.Infrastructure \
  --startup-project backend/ToeicMasterPro.API
```

**Rollback & xóa migration:**
```bash
# Rollback về migration cụ thể:
dotnet ef database update InitialCreate ...

# Xóa migration gần nhất (chưa apply):
dotnet ef migrations remove ...
```

**Workflow hằng ngày:**
```
1. Sửa/thêm Entity class trong Domain/Entities/
2. Cập nhật DbContext (thêm DbSet<> nếu bảng mới)
3. dotnet ef migrations add <TenRoNghia>
4. Kiểm tra file migration vừa tạo trong Migrations/
5. dotnet ef database update
6. Tiếp tục code feature
```

**Quy ước đặt tên:**
- ✅ `AddUserStreakTable`, `AddIndexToQuestionPart`, `SeedInitialRoles`
- ❌ `Migration1`, `Fix`, `Update`

</details>
