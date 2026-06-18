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

**Cấu trúc:**
```
Domain/
├── Entities/           ← Các class đại diện bảng DB (User, Question, Test...)
├── Enums/              ← Enum dùng trong business (QuestionPart, UserRole...)
├── Interfaces/         ← Contract mà Infrastructure phải implement
└── Common/
    ├── BaseEntity.cs   ← Base class: Id, CreatedAt, UpdatedAt
    └── Result.cs       ← Wrapper thành công/thất bại, thay vì throw Exception
```

**Ví dụ thực tế:**
```csharp
// Domain/Entities/Question.cs
public class Question : BaseEntity
{
    public string Content { get; private set; }
    public QuestionPart Part { get; private set; }       // Enum: Part1..Part7
    public DifficultyLevel Difficulty { get; private set; }

    // Business rule: chỉ tạo question hợp lệ qua factory method
    public static Result<Question> Create(string content, QuestionPart part)
    {
        if (string.IsNullOrWhiteSpace(content))
            return Result<Question>.Failure("Nội dung không được rỗng");
        return Result<Question>.Success(new Question { Content = content, Part = part });
    }
}
```

> ❌ KHÔNG import `Microsoft.EntityFrameworkCore`, `Microsoft.AspNetCore`, hay bất kỳ package nào trong layer này.

</details>

---

<details>
<summary>🟢 Layer 2 — Application <code>ToeicMasterPro.Application</code></summary>

**Là gì:** Lớp điều phối — định nghĩa *ứng dụng có thể làm gì* (use cases). Biết Domain, không biết Infrastructure hay API.

**Cấu trúc:**
```
Application/
├── Features/                         ← Mỗi feature là 1 folder (Vertical Slice)
│   ├── Auth/
│   │   ├── Commands/
│   │   │   ├── RegisterCommand.cs          ← Request (dữ liệu đầu vào)
│   │   │   ├── RegisterCommandHandler.cs   ← Xử lý logic
│   │   │   └── RegisterCommandValidator.cs ← Validate với FluentValidation
│   │   └── Queries/
│   │       └── GetUserProfileQuery.cs
│   ├── Tests/
│   │   ├── Commands/SubmitTestCommand.cs
│   │   └── Queries/GetTestByIdQuery.cs
│   └── Vocabulary/...
└── Common/
    ├── Interfaces/         ← Contract cho Infrastructure implement
    │   ├── IApplicationDbContext.cs
    │   ├── ICacheService.cs
    │   ├── ICurrentUserService.cs
    │   └── IAiService.cs
    ├── DTOs/               ← Data Transfer Objects trả về cho API
    └── Behaviors/          ← MediatR pipeline (logging, validation)
```

**Ví dụ — Submit bài thi:**
```csharp
public record SubmitTestCommand(Guid SessionId, List<AnswerDto> Answers)
    : IRequest<Result<TestResultDto>>;

public class SubmitTestCommandHandler : IRequestHandler<SubmitTestCommand, Result<TestResultDto>>
{
    public async Task<Result<TestResultDto>> Handle(SubmitTestCommand cmd, CancellationToken ct)
    {
        var session = await _db.TestSessions.FindAsync(cmd.SessionId);
        var score = CalculateScore(session, cmd.Answers);  // business logic
        session.Complete(score);
        await _db.SaveChangesAsync(ct);
        await _ai.GenerateWeakAreaAnalysisAsync(session.UserId, score);
        return Result<TestResultDto>.Success(score.ToDto());
    }
}
```

</details>

---

<details>
<summary>🟠 Layer 3 — Infrastructure <code>ToeicMasterPro.Infrastructure</code></summary>

**Là gì:** Lớp kỹ thuật — implement các interface mà Application định nghĩa. Biết tất cả về DB, cache, AI nhưng không biết business logic.

**Cấu trúc:**
```
Infrastructure/
├── Persistence/
│   ├── ApplicationDbContext.cs          ← EF Core DbContext
│   ├── Configurations/                  ← Cấu hình bảng (Fluent API)
│   │   ├── UserConfiguration.cs
│   │   └── QuestionConfiguration.cs
│   ├── Migrations/                      ← Auto-generated bởi EF Core CLI
│   └── Repositories/
├── Services/
│   ├── AI/ClaudeAiService.cs            ← Implement IAiService
│   ├── Cache/RedisCacheService.cs       ← Implement ICacheService
│   └── Email/SendGridEmailService.cs    ← Implement IEmailService
└── DependencyInjection.cs               ← Đăng ký tất cả service vào DI
```

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

**Là gì:** Entry point. Nhận HTTP request, gọi Application qua MediatR, trả response. Không chứa business logic.

**Cấu trúc:**
```
API/
├── Controllers/
│   ├── AuthController.cs        ← POST /api/auth/register, /login
│   ├── TestsController.cs       ← GET /api/tests, POST /api/tests/{id}/submit
│   ├── VocabularyController.cs
│   └── ScheduleController.cs
├── Middleware/
│   ├── ExceptionMiddleware.cs   ← Bắt exception → trả lỗi chuẩn RFC 7807
│   └── CurrentUserMiddleware.cs ← Inject ICurrentUserService từ JWT claims
├── Program.cs                   ← Cấu hình DI, middleware, CORS
└── appsettings.json
```

**Controller cực gọn — không có logic:**
```csharp
[ApiController, Route("api/tests"), Authorize]
public class TestsController(ISender mediator) : ControllerBase
{
    [HttpPost("{sessionId}/submit")]
    public async Task<IActionResult> Submit(Guid sessionId, SubmitTestRequest req)
    {
        var result = await mediator.Send(new SubmitTestCommand(sessionId, req.Answers));
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }
}
// Chỉ 5 dòng — toàn bộ logic nằm trong Handler
```

</details>

---

<details>
<summary>🔄 Luồng xử lý một request hoàn chỉnh</summary>

```
HTTP POST /api/tests/{id}/submit
         │
         ▼
  [ExceptionMiddleware]           ← bắt mọi exception chưa xử lý
         │
         ▼
  [AuthMiddleware - JWT]          ← xác thực token, inject user vào context
         │
         ▼
  TestsController.Submit()        ← parse request, gọi mediator.Send()
         │
         ▼
  [ValidationBehavior]            ← FluentValidation chạy trước handler
         │
         ▼
  SubmitTestCommandHandler        ← business logic
         │
         ├── ApplicationDbContext → SQL Server
         ├── RedisCacheService   → Redis
         └── ClaudeAiService     → Anthropic API
         │
         ▼
  200 OK { score: 745, listening: 390, reading: 355 }
```

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
