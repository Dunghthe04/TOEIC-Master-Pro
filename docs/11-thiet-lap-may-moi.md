# Thiết lập máy mới / máy khác

> **Mục đích:** những thứ **KHÔNG đi theo git** — phải làm lại trên mỗi máy. Không làm thì app
> không chạy được, hoặc chạy mà audio 404.
>
> **Cập nhật:** 2026-08-05, sau khi vá 7/8 lỗi chặn deploy.

---

## Vì sao cần file này

| Thứ | Đi theo git? | Lý do |
|---|---|---|
| Code | ✅ | `git pull` là có |
| **User Secrets** | ❌ | Nằm ở `%APPDATA%\Microsoft\UserSecrets\<id>` — theo máy, theo user. Đó là **điểm mạnh**: không thể commit nhầm |
| **File media** (158MB audio/ảnh đề thi) | ❌ | Bản quyền ETS, `.gitignore` chặn |
| **Dữ liệu DB** | ❌ | Nằm trong Docker volume |
| **Container Docker** | ❌ | Sửa `docker-compose.yml` không áp cho container đang chạy |

---

## 1. Bảy User Secrets — bắt buộc

Thiếu bất kỳ khóa nào trong 2 khóa đầu → app **fail-fast lúc boot** kèm thông báo rõ
(`Program.cs` hàm `RequireConfig`).

```powershell
cd backend\ToeicMasterPro.API
dotnet user-secrets list      # kiểm trước — nếu đủ 7 khóa thì bỏ qua mục này
```

Nếu rỗng, đặt lại (thay mật khẩu cho khớp máy đó):

```powershell
cd backend\ToeicMasterPro.API

# 1-2. Bắt buộc — thiếu là app không boot
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=127.0.0.1,1434;Database=ToeicMasterPro;User Id=sa;Password=ToeicMaster@2026;TrustServerCertificate=True"
dotnet user-secrets set "Redis:ConnectionStrings" "127.0.0.1:6379,password=ToeicRedis@2026,abortConnect=false"

# 3. JWT — PHẢI >= 32 byte, sinh MỚI cho mỗi máy
$b = New-Object byte[] 48
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
dotnet user-secrets set "Jwt:SecretKey" ([Convert]::ToBase64String($b))

# 4-5. Tài khoản seed
dotnet user-secrets set "AdminSeed:Password" "Admin@2026"
dotnet user-secrets set "ContentManagerSeed:Password" "CmPass@2026"

# 6-7. Hangfire Dashboard — chỉ dùng ở Production, nhưng đặt sẵn để test
dotnet user-secrets set "Hangfire:DashboardUser" "hfadmin"
dotnet user-secrets set "Hangfire:DashboardPassword" "HangfireDash@2026"
```

### ⚠️ Hai điểm dễ sai

**`127.0.0.1` — KHÔNG dùng `localhost`.** Từ 2026-08-05, `docker-compose.yml` bind
`127.0.0.1:1434:1433` (trước đó là `0.0.0.0`). Trên Windows `localhost` phân giải ra **`::1`
(IPv6) trước**, mà binding chỉ có IPv4 → `SqlClient` bị *"actively refused"* và **không fallback**.

Cùng lỗi này đã gặp 2 lần trong một buổi: SQL Server, và
`LocalRequestsOnlyAuthorizationFilter` của Hangfire.

**`abortConnect=false` trong Redis connection string.** Thiếu nó thì Redis tạm chết →
`ConnectionMultiplexer.Connect()` throw. Cùng với factory lambda ở `Program.cs`, đây là thứ
làm Redis thành dependency **tùy chọn thật sự** (nó đang là mã chết — `ICacheService` không
service nào inject).

**`Jwt:SecretKey` sinh mới mỗi máy.** Không copy từ máy khác. Đổi khóa = mọi token đang lưu
hành vô hiệu, phải đăng nhập lại — bình thường.

> `ToeicMasterPro.Infrastructure.csproj` dùng **chung `UserSecretsId`** với API
> (`0141a41e-1297-4311-a748-dd280f3f17b2`) để `dotnet ef` đọc được cùng store. Khác id là
> `dotnet ef` báo *"The ConnectionString property has not been initialized"*.

---

## 2. Docker — phải RECREATE, không chỉ `up -d`

```powershell
cd c:\TOEIC-Master-Pro
docker compose up -d --force-recreate
docker compose ps                      # cả hai phải "(healthy)"
docker port toeic_sqlserver            # PHẢI thấy 127.0.0.1:1434
docker port toeic_redis                # PHẢI thấy 127.0.0.1:6379
```

**Vì sao `--force-recreate`:** `docker compose up -d` **không** tạo lại container nếu image
không đổi. Container cũ vẫn giữ binding `0.0.0.0` — bạn sửa file mà không thấy tác dụng.

Thấy `0.0.0.0:1434` là chưa recreate.

---

## 3. Migrate DB (máy mới / DB trống)

```powershell
cd c:\TOEIC-Master-Pro
dotnet ef database update --project backend\ToeicMasterPro.Infrastructure --startup-project backend\ToeicMasterPro.API
```

⚠️ Trong **Git Bash** phải dùng `/`, không dùng `\` (Bash coi `\` là escape):
```bash
dotnet ef database update --project backend/ToeicMasterPro.Infrastructure --startup-project backend/ToeicMasterPro.API
```

---

## 4. 🔴 Di chuyển file media ra khỏi wwwroot

**Bắt buộc trên mọi máy đã có media.** Không làm thì audio/ảnh vẫn public — lỗ hổng #8 chưa vá.

```powershell
cd c:\TOEIC-Master-Pro\backend\ToeicMasterPro.API

# Dừng app trước (file .mp3 đang mở sẽ không move được)
Get-Process ToeicMasterPro.API -ErrorAction SilentlyContinue | Stop-Process -Force

New-Item -ItemType Directory -Force protected-media\tests | Out-Null
Move-Item wwwroot\uploads\tests\* protected-media\tests\

# Xác nhận
Get-ChildItem protected-media -Recurse -File | Measure-Object -Property Length -Sum |
  Select-Object Count, @{n='MB';e={[math]::Round($_.Sum/1MB,1)}}
Get-ChildItem wwwroot\uploads          # chỉ còn avatars (+ tests rỗng, vô hại)
```

Git Bash:
```bash
cd /c/TOEIC-Master-Pro/backend/ToeicMasterPro.API
mkdir -p protected-media/tests
mv wwwroot/uploads/tests/* protected-media/tests/
```

**Cấu trúc sau khi xong:**
```
backend/ToeicMasterPro.API/
├── wwwroot/uploads/avatars/      ← CÔNG KHAI, serve qua UseStaticFiles
└── protected-media/tests/        ← BẢO VỆ, serve qua MediaFileController có [Authorize]
    └── {testId}/{audio,images}/
```

**Vì sao phải chuyển ra ngoài `wwwroot`:** `UseStaticFiles` là **middleware terminal** — khớp
đường dẫn là trả file rồi dừng pipeline, **không bao giờ** chạm `UseAuthorization`. Đổi thứ tự
middleware **không** cứu được. Cách duy nhất là để file ngoài `wwwroot`.

---

## 5. 🔴 Cập nhật URL media trong DB

**Bắt buộc nếu DB đã có câu hỏi.** Code sinh URL đã đổi, nhưng bản ghi cũ vẫn giữ chuỗi cũ →
audio **404 hết**.

Kiểm trước:
```sql
SELECT COUNT(*) FROM Questions WHERE AudioUrl LIKE '%/uploads/tests/%';
SELECT COUNT(*) FROM Questions WHERE ImageUrl LIKE '%/uploads/tests/%';
```

Sửa:
```sql
UPDATE Questions SET AudioUrl = REPLACE(AudioUrl, '/uploads/tests/', '/api/media/tests/')
WHERE AudioUrl LIKE '%/uploads/tests/%';

UPDATE Questions SET ImageUrl = REPLACE(ImageUrl, '/uploads/tests/', '/api/media/tests/')
WHERE ImageUrl LIKE '%/uploads/tests/%';

-- Kho câu chung (nếu có)
UPDATE Questions SET AudioUrl = REPLACE(AudioUrl, '/uploads/listening/', '/api/media/listening/')
WHERE AudioUrl LIKE '%/uploads/listening/%';
UPDATE Questions SET ImageUrl = REPLACE(ImageUrl, '/uploads/listening/', '/api/media/listening/')
WHERE ImageUrl LIKE '%/uploads/listening/%';
```

Xác nhận — phải ra **0**:
```sql
SELECT COUNT(*) FROM Questions WHERE AudioUrl LIKE '/uploads/%' OR ImageUrl LIKE '/uploads/%';
```

Chạy qua Docker:
```powershell
docker exec toeic_sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "ToeicMaster@2026" -C -d ToeicMasterPro -Q "<câu SQL>"
```

> `ImageUrl` có thể chứa **nhiều URL cách nhau bằng `;`** (Part 6-7). `REPLACE` xử lý đúng vì
> nó thay **mọi** lần xuất hiện. Ở máy công ty: 200 dòng Audio + 104 dòng Image, có ca 2 URL.

---

## 6. Kiểm chứng — 8 phép thử

```powershell
dotnet run --project backend\ToeicMasterPro.API
```

```powershell
$TID = "<guid-đề-published>"
$U = "http://localhost:5191/api/media/tests/$TID/audio/<tên-file>.mp3"

$body = @{ email = "admin@toeicmaster.com"; password = "Admin@2026" } | ConvertTo-Json
$jwt = (Invoke-RestMethod http://localhost:5191/api/auth/login -Method Post -Body $body -ContentType "application/json").accessToken
$mt = (Invoke-RestMethod "http://localhost:5191/api/media/token/$TID" -Headers @{ Authorization = "Bearer $jwt" }).token
```

| # | Lệnh | Mong đợi | Kiểm |
|---|---|---|---|
| 1 | `curl.exe -s -o $null -w "%{http_code}" "$U"` | **401** | Không token → chặn |
| 2 | `curl.exe -s -o $null -w "%{http_code}" "$U`?t=$mt"` | **200** | ⭐ `<audio>` tải được không cần header |
| 3 | `... "$U`?t=abc.123.xyz"` | **401** | Chữ ký sai |
| 4 | `... "$U" -H "Authorization: Bearer $jwt"` | **200** | Bearer vẫn dùng được |
| 5 | `... "$U`?t=$mt" -H "Range: bytes=0-1023"` | **206** | ⭐ Tua audio / iOS Safari |
| 6 | Dùng `$mt` cho **đề khác** | **401** | ⭐ Token ký theo testId |
| 7 | Học viên xin token **đề nháp** | **403** | ⭐ Kiểm `IsPublished` |
| 8 | `/uploads/tests/...` + Bearer | **404** | File đã ra khỏi wwwroot |

Rồi UI:
```
□ npm run dev (thư mục frontend)
□ Đăng nhập User → chọn đề → thi Part 1
□ DevTools Network lọc "media":
   - GET /media/token/{id} → 200, CHỈ MỘT LẦN (không phải 100 lần)
   - Mọi .mp3/.png có ?t=... và trả 200
□ Ảnh Part 1 hiện · audio phát · TUA ĐƯỢC
□ Part 6/7: ảnh nhiều URL hiện đủ
□ Panel CM → TestQuestionsPage: audio phát được kể cả đề nháp
```

---

## 7. Checklist gọn — dán vào terminal máy mới

```
□ git pull
□ dotnet user-secrets list  → nếu rỗng, đặt 7 khóa (mục 1)
   ⚠️ 127.0.0.1 KHÔNG phải localhost
   ⚠️ Redis có abortConnect=false
□ docker compose up -d --force-recreate
□ docker port toeic_sqlserver → PHẢI 127.0.0.1:1434
□ dotnet ef database update (nếu DB mới)
□ Dừng app → move wwwroot/uploads/tests/* → protected-media/tests/
□ SQL UPDATE 2 cột AudioUrl, ImageUrl
□ dotnet run → login được
□ 8 phép thử curl
□ UI: thi 1 Part, audio phát + tua được
```

---

## Phụ lục — vì sao mỗi máy phải cấu hình lại

Đây là **cái giá** của việc secret không nằm trong git, và là câu trả lời phỏng vấn:

> *"Secret lỡ commit vào git thì xử lý sao?"*
>
> Rotate khóa (xóa file **không đủ** — git giữ lịch sử), chuyển sang User Secrets cho dev và
> biến môi trường cho production. Cái giá là mỗi máy phải cấu hình lại; đổi lại là **không thể
> commit nhầm**. Với repo cá nhân chưa public thì rẻ hơn `git filter-repo` rất nhiều.

Trước 2026-08-05, `appsettings.Development.json` chứa JWT SecretKey + mật khẩu `sa` và **bị git
track từ commit đầu tiên** — ai clone repo đều tự ký được token role Admin.
