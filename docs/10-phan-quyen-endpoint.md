# Bảng phân quyền endpoint × role

> **Mục đích:** nguồn sự thật duy nhất về "ai gọi được endpoint nào". Mở file này ra khi cần trả lời
> *"hệ thống phân quyền thế nào"* — thay vì mô tả bằng miệng.
>
> **Ngày lập:** 2026-08-04 (Day 34) · **Sau khi vá:** lỗ hổng lộ đáp án cho người chưa đăng nhập

---

## 1. Cơ chế: mặc định ĐÓNG

`Program.cs:134-137` đăng ký **fallback policy**:

```csharp
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());
```

Endpoint **không có** metadata authorization nào sẽ bị áp policy này → phải đăng nhập.

**Hệ quả về mô hình lỗi:**

| Tình huống | Trước Day 34 | Sau Day 34 |
|---|---|---|
| Quên `[Authorize]` trên endpoint mới | **Lộ dữ liệu im lặng** — không ai biết | 401 — phát hiện ngay lần test đầu |
| Quên `[AllowAnonymous]` cho endpoint công khai | — | 401 — endpoint không dùng được, phát hiện ngay |

Đây là nguyên tắc **fail secure** (hỏng an toàn) thay vì **fail open** (hỏng nguy hiểm).

### ⚠️ `FallbackPolicy` khác `DefaultPolicy`

| | Áp dụng khi |
|---|---|
| **`DefaultPolicy`** | Endpoint **CÓ** `[Authorize]` nhưng không ghi rõ policy/role. Mặc định = `RequireAuthenticatedUser` |
| **`FallbackPolicy`** | Endpoint **KHÔNG CÓ** metadata authorization nào. Mặc định = `null` (cho qua hết) ← thứ đã sửa |

**Suy ra:** vì cả hai giờ đều là `RequireAuthenticatedUser`, viết `[Authorize]` **trần** là **vô nghĩa** — không siết thêm gì so với fallback. Muốn siết phải ghi `Roles` hoặc `Policy`.

### ⚠️ Authorization KHÔNG áp dụng cho middleware

Fallback policy chỉ chạy trong `UseAuthorization` với **endpoint**. Hai chỗ sau là **middleware terminal** — tự xử lý request rồi trả về, không bao giờ chạm tới authorization:

| Chỗ | Trạng thái |
|---|---|
| `app.UseStaticFiles()` | 🟢 Chỉ còn serve `wwwroot/uploads/avatars` — thật sự công khai. Audio/ảnh đề thi đã chuyển sang `protected-media/` (ngoài wwwroot), serve qua `MediaFileController` |
| `app.MapHangfireDashboard()` | 🟢 Basic Auth + `IsReadOnlyFunc` ở Production. Thiếu credential → **không mount** |

**Đừng tưởng bật fallback policy là mọi thứ tự an toàn.** Hai bài học từ đợt vá 2026-08-05:

**1. `UseStaticFiles` là middleware TERMINAL** — khớp đường dẫn là trả file rồi dừng pipeline,
**không bao giờ** chạm `UseAuthorization`. Đổi thứ tự middleware **không** cứu được; cách duy nhất
là để file cần bảo vệ **ngoài** `wwwroot`.

**2. Ngược lại, `MapScalarApiReference` là ENDPOINT** nên fallback policy áp lên nó → `/scalar` trả
401 dù chỉ là trang tài liệu. Phải `.AllowAnonymous()`. Còn `UseSwagger`/`UseSwaggerUI` là
middleware nên vẫn mở bình thường.

→ Cùng một trang tài liệu, hai kết cục khác nhau chỉ vì **middleware vs endpoint**.

---

## 2. Ba role

| Role | Nguồn | Nhiệm vụ |
|---|---|---|
| `User` | mặc định khi đăng ký | Học và thi |
| `ContentManager` | seed / Admin gán | Sản xuất nội dung |
| `Admin` | seed | Quản người, nhìn toàn cảnh |

---

## 3. Bảng endpoint × role

Ký hiệu: ✅ gọi được · ❌ 403 Forbidden · 🔓 không cần đăng nhập (401 nếu thiếu ở cột khác)

### AuthController — `[AllowAnonymous]` cấp class

| Endpoint | Ẩn danh | User | CM | Admin | Ghi chú |
|---|---|---|---|---|---|
| `POST /api/auth/register` | 🔓 | ✅ | ✅ | ✅ | |
| `POST /api/auth/login` | 🔓 | ✅ | ✅ | ✅ | |
| `POST /api/auth/refresh-token` | 🔓 | ✅ | ✅ | ✅ | Access token hết hạn vẫn gọi được |
| `POST /api/auth/logout` | ❌ 401 | ✅ | ✅ | ✅ | **`[Authorize]` cấp action** — đã vá ở Day 34 |
| `GET /api/auth/confirm-email` | 🔓 | ✅ | ✅ | ✅ | Click từ email |
| `POST /api/auth/forgot-password` | 🔓 | ✅ | ✅ | ✅ | |
| `POST /api/auth/reset-password` | 🔓 | ✅ | ✅ | ✅ | |
| `POST /api/auth/google-login` | 🔓 | ✅ | ✅ | ✅ | |

> Cả controller bị `[EnableRateLimiting("auth")]` — **5 request/phút/IP**. Ghi chú: policy này bóp cả
> `refresh-token` và `logout`, cần tách riêng ở Day 48.

### QuestionController — `[Authorize(Roles = "Admin,ContentManager")]` cấp class

| Endpoint | Ẩn danh | User | CM | Admin |
|---|---|---|---|---|
| `GET /api/question` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/question/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `POST /api/question` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `PUT /api/question/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `DELETE /api/question/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `POST /api/question/import` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `GET /api/question/import-template` | ❌ 401 | ❌ 403 | ✅ | ✅ |

> **🔴 Đây là lỗ hổng chính đã vá.** Trước Day 34: hai `GET` đầu **ẩn danh** và trả `QuestionResponse`
> chứa `Explanation` + `OptionResponse.IsCorrect`.
>
> **Chuỗi khai thác đã bị chặn:** `PlayQuestionItem` trả về chính `Question.Id` khi đang thi → client
> cầm sẵn `questionId` → gọi `GET /api/question/{id}` ẩn danh = **tra đáp án đúng của đúng câu đó**,
> tự động hóa được.
>
> Học viên **không** cần controller này. Luồng thi dùng `/api/test/{id}/play` với DTO đã giấu đáp án.

### TestController — `[Authorize]` cấp class, siết thêm 2 endpoint đọc

| Endpoint | Ẩn danh | User | CM | Admin | Vì sao |
|---|---|---|---|---|---|
| `GET /api/test` | ❌ 401 | ❌ 403 | ✅ | ✅ | Trả cả **đề nháp chưa publish** |
| `GET /api/test/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ | Lộ cấu trúc đề đầy đủ |
| `GET /api/test/published` | ❌ 401 | ✅ | ✅ | ✅ | **Học viên PHẢI gọi** để chọn đề |
| `GET /api/test/{id}/structure` | ❌ 401 | ✅ | ✅ | ✅ | Màn chọn Part |
| `GET /api/test/{id}/play` | ❌ 401 | ✅ | ✅ | ✅ | Gói câu thi — DTO **không** có `IsCorrect` |
| `POST /api/test` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `PUT /api/test/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `DELETE /api/test/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `POST /api/test/{id}/questions` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `DELETE /api/test/{id}/questions/{qid}` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `POST /api/test/{id}/import-zip` | ❌ 401 | ❌ 403 | ✅ | ✅ | |

> **Vì sao xử lý khác `QuestionController`:** controller này **phục vụ cả hai đối tượng**. Baseline
> `[Authorize]` cho học viên, siết `Roles` riêng ở chỗ nhạy cảm. `QuestionController` toàn bộ là việc
> của CM nên cấp class phủ hết và **các attribute cấp action bị xóa vì trùng lặp**.
>
> Phân quyền theo **ai dùng**, không theo **file nào**.

### VocabularyController — `[Authorize]` cấp class

| Endpoint | Ẩn danh | User | CM | Admin |
|---|---|---|---|---|
| `GET /api/vocabulary` | ❌ 401 | ✅ | ✅ | ✅ |
| `GET /api/vocabulary/{id}` | ❌ 401 | ✅ | ✅ | ✅ |
| `POST /api/vocabulary` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `PUT /api/vocabulary/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ |
| `DELETE /api/vocabulary/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ |

### ExamScheduleController — `[Authorize]` cấp class, 3 endpoint mở

| Endpoint | Ẩn danh | User | CM | Admin | Vì sao |
|---|---|---|---|---|---|
| `GET /api/examschedule` | 🔓 | ✅ | ✅ | ✅ | Lịch thi TOEIC là thông tin công khai |
| `GET /api/examschedule/{id}` | 🔓 | ✅ | ✅ | ✅ | |
| ~~`GET /api/examschedule/{id}/ical`~~ | — | — | — | — | **ĐÃ BỎ 2026-08-20** — xem ghi chú dưới |
| `GET /api/examschedule/my-reminders` | ❌ 401 | ✅ | ✅ | ✅ | Gắn với user |
| `POST /api/examschedule/{id}/reminder` | ❌ 401 | ✅ | ✅ | ✅ | |
| `DELETE /api/examschedule/{id}/reminder` | ❌ 401 | ✅ | ✅ | ✅ | |
| `POST /api/examschedule` | ❌ 401 | ❌ 403 | ✅ | ✅ | Nhập lịch thủ công từ IIG/BC |
| `PUT /api/examschedule/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ | |
| `DELETE /api/examschedule/{id}` | ❌ 401 | ❌ 403 | ✅ | ✅ | |

> **Quyết định:** giữ 2 endpoint đọc công khai để landing page hiện được lịch thi khi chưa đăng nhập.
>
> ✅ **Đã xử lý 2026-08-20 (Day 49):** `ExportIcal` bị **BỎ HẲN**, không phải vá.
>
> Lỗ hổng gốc: `RegisterUrl` ghi thẳng vào file `.ics` không escape → URL chứa CRLF chèn được
> dòng lệnh iCal giả (ghi đè `DESCRIPTION`, thêm `VEVENT`), user import vào Google Calendar thấy
> nội dung lừa đảo trông như hệ thống gửi.
>
> **Vì sao bỏ thay vì vá:** nút Download đã gỡ khỏi UI từ trước (docs 12) → endpoint là **mã
> chết**, không ai gọi nhưng vẫn là bề mặt tấn công. Xóa rẻ hơn và chắc hơn escape.
>
> Xóa 4 chỗ: `ExamScheduleController.ExportIcal` · `IExamScheduleService.GetIcalAsync` ·
> `ExamScheduleService.GetIcalAsync/EscapeIcal/IsSafeHttpUrl` · `exam-schedule.service.ts
> downloadIcal`.

### TestSessionController — `[Authorize]` cấp class

Toàn bộ endpoint: ❌ ẩn danh · ✅ User/CM/Admin. Lấy `userId` từ JWT, **có ownership check** ở phiên thi.

### Còn lại

| Controller | Policy cấp class | Ẩn danh | User | CM | Admin |
|---|---|---|---|---|---|
| `ProfileController` | `[Authorize]` | ❌ 401 | ✅ | ✅ | ✅ |
| `SrsController` | `[Authorize(Roles = "User")]` | ❌ 401 | ✅ | ❌ 403 | ❌ 403 |
| `PracticeController` | `[Authorize(Roles = "User")]` | ❌ 401 | ✅ | ❌ 403 | ❌ 403 |
| `MediaController` (upload) | `[Authorize(Roles = "Admin,ContentManager")]` | ❌ 401 | ❌ 403 | ✅ | ✅ |

`ProfileController` là controller **duy nhất** còn `[Authorize]` trần — cố ý: profile là của chính mình nên cả ba vai đều xem/sửa được. `SrsController`/`PracticeController` siết `Roles="User"` từ Day 35: CM soạn nội dung, Admin quản account — không vai nào cần học hay luyện.

### AdminController — `[Authorize(Roles = "Admin")]` cấp class

Chỉ ĐỌC số liệu, không CRUD nội dung.

| Endpoint | Ẩn danh | User | CM | Admin | Ghi chú |
|---|---|---|---|---|---|
| `GET /api/admin/overview` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | Card tổng quan |
| `GET /api/admin/stats?days=` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | Biểu đồ, `days` kẹp 7–180 |
| `GET /api/admin/active-sessions?staleHours=` | ❌ 401 | ❌ 403 | ❌ 403 | ✅ | Phiên đang thi + phiên treo, `staleHours` kẹp 1–72 |

### AdminUsersController — `[Authorize(Roles = "Admin")]` cấp class

Thao tác GHI lên tài khoản người khác. Tách khỏi `AdminController` vì khác nhóm quan tâm.

| Endpoint | Ghi chú |
|---|---|
| `GET /api/admin/users` | Phân trang **dưới SQL**, `pageSize` kẹp ≤100. Roles + số lượt thi lấy **1 query cho cả trang**, không N+1 |
| `GET /api/admin/users/{id}` | Chi tiết + lịch sử thi. Tái dùng `ITestSessionService` để con số khớp với dashboard học viên |
| `POST /api/admin/users` | Tạo tài khoản (chủ yếu lập tài khoản CM). **Không nhận mật khẩu** — gửi mail để người đó tự đặt |
| `PUT /api/admin/users/{id}/roles` | Gửi **toàn bộ** danh sách vai, không add/remove từng cái |
| `PUT /api/admin/users/{id}/lock` | Khoá/mở. Khoá kèm **thu hồi refresh token** |
| `POST /api/admin/users/{id}/send-password-reset` | Gửi mail đặt lại. Admin **không bao giờ** biết mật khẩu ai |
| `POST /api/admin/users/{id}/confirm-email` | Xác thực email thủ công khi user không nhận được mail |

**Ba chốt an toàn phía server** (không chỉ ẩn nút):

| Chặn | Vì sao |
|---|---|
| Không tự bỏ vai Admin của mình | Mất quyền vào trang quản trị, chỉ sửa được bằng SQL tay |
| Không hạ Admin **cuối cùng** | Cùng lý do, chỉ khác là người bị hạ là Admin khác |
| Không tự khoá mình | Khoá rồi không còn quyền vào để tự mở |

**Không có endpoint XOÁ tài khoản** — cố ý. Khoá đủ để chặn truy cập; xoá user đã thi thì vướng FK `TestSessions` hoặc mất sạch lịch sử thi (méo thống kê toàn hệ thống).

### MediaFileController — serve media đề thi (thêm 2026-08-05)

| Endpoint | Ẩn danh | User | CM/Admin | Ghi chú |
|---|---|---|---|---|
| `GET /api/media/token/{testId}` | ❌ 401 | ✅ nếu đề **published**, ❌ 403 nếu nháp | ✅ kể cả đề nháp | Cấp token 10 phút, gọi qua axios |
| `GET /api/media/tests/{testId}/{audio\|images}/{file}?t=` | ❌ 401 | ✅ với token đúng đề | ✅ | `[AllowAnonymous]` + verify `?t=` |

> **⚠️ `[AllowAnonymous]` ở đây KHÔNG phải mở cửa.** Thẻ `<audio>`/`<img>` do **trình duyệt** tải
> nên không gắn được `Authorization` header → fallback policy sẽ chặn cả người dùng hợp lệ.
> Bảo vệ chuyển sang verify token trong query string. Ba tầng:
>
> 1. Token ký HMAC-SHA256, sống 10 phút
> 2. Kiểm `IsPublished` **lúc cấp** token (cấp 1 lần/10 phút vs tải 100+ lần — không thể query DB
>    mỗi thẻ `<img>`)
> 3. Ký `testId` **vào** chữ ký → token đề 1 **không** tải được media đề 2
>
> Vẫn chấp nhận Bearer nếu có (curl/Postman/axios). Chi tiết: [09 — mục 1.8](09-hien-trang-va-khuyen-nghi.md).

> ✅ **`PracticeController` — nợ ĐÃ TRẢ (Day 47).** Trước đây `POST /api/practice/submit` chấm
> **bất kỳ `questionId` nào** gửi lên, không kiểm câu đó có thuộc phiên luyện của user không →
> **máy tra đáp án hợp lệ, có xác thực đàng hoàng**. Endpoint có `[Authorize]` nhưng thiếu
> **ownership check**.
>
> Nay `PracticeSession` lưu `QuestionIds` lúc phát đề, và `SubmitAsync` chỉ chấm câu **thuộc**
> danh sách đó. Phiên không tồn tại và phiên của người khác trả **cùng một 404 với cùng một
> thông báo** — hai message khác nhau là đủ để dò `sessionId` nào tồn tại (IDOR).
>
> Bài học: `[Authorize]` trả lời *"bạn là ai"*, **không** trả lời *"dữ liệu này có phải của bạn"*.

---

## 4. Bằng chứng kiểm chứng (2026-08-04)

Chạy bằng `curl` với token thật, không phải suy luận từ code:

| Phép thử | Kết quả | Ý nghĩa |
|---|---|---|
| `GET /api/question` không token | `401` + `WWW-Authenticate: Bearer` | Fallback policy chạy |
| `GET /api/question` + token User | `403` + **`Content-Length: 0`** | Bị chặn ở middleware |
| `DELETE /api/question/{guid}` + token User | `403` + **`Content-Length: 0`** | Chưa vào service |
| `GET /api/question` + token Admin | `200` + JSON | Không khóa quá tay |

> **🔍 Kỹ năng đọc response — `Content-Length: 0` là chi tiết quyết định.**
>
> Trong lúc sửa đã gặp trạng thái trung gian: `DELETE` trả `400` kèm
> `{"error":"Không tìm thấy câu hỏi."}`. Body tiếng Việt đó là **của service** → chứng tỏ request **đã
> đi qua** authorization. Nguyên nhân: `[Authorize]` trần thiếu `Roles`. Nếu GUID trỏ tới câu hỏi có
> thật thì nó đã **trả 200 và xóa thật**.
>
> **`403` + không body = bị chặn ở middleware. `400` + body nghiệp vụ = đã vào service.**

### Phân biệt 401 / 403

| Mã | Nghĩa | Nguyên nhân |
|---|---|---|
| **401 Unauthorized** | *"Tôi không biết bạn là ai"* | Thiếu token, token sai/hết hạn (kèm `error="invalid_token"`) |
| **403 Forbidden** | *"Tôi biết bạn là ai, và bạn không được phép"* | Token hợp lệ, thiếu role |

---

## 5. Nợ còn lại về authorization

| Việc | Vị trí | Day |
|---|---|---|
| ~~Static files public — audio/ảnh đề thi~~ | ✅ **vá 2026-08-05** — chuyển sang `protected-media/` + signed URL | — |
| ~~Hangfire Dashboard không có authorization~~ | ✅ **vá 2026-08-05** — Basic Auth + `IsReadOnlyFunc` | — |
| Tách DTO theo người xem — `MapToResponse` vẫn trả `IsCorrect` cho mọi caller | `QuestionService.cs:140` | 35 |
| Backend chưa trả `roles` cho frontend → UI không biết user là ai | DTO profile | 35 |
| Frontend chưa lọc menu theo role — User thấy menu quản trị | `Sidebar.tsx` | 36 |
| `PracticeController` thiếu ownership check | `PracticeService.cs:69` | 47 |
| Mọi lỗi nghiệp vụ trả 400 — không phân biệt 403/404 | toàn bộ service | 49 |
| ~~Rate limit `"auth"` bóp cả `refresh-token` và `logout`~~ | ✅ **vá 2026-08-08** — policy `"auth-refresh"` 30/phút, đè ở cấp action (chưa kiểm chứng runtime) | — |

---

## 6. Khi thêm endpoint mới — checklist

```
□ Endpoint này ai được gọi? (ẩn danh / User / CM / Admin)
□ Cần [AllowAnonymous]? → chỉ khi THẬT SỰ công khai
□ Cần Roles? → nhớ: [Authorize] TRẦN là vô nghĩa (trùng fallback policy)
□ Trả về DTO nào? Có lộ IsCorrect / Explanation / IsPublished không?
□ Có cần ownership check? ([Authorize] KHÔNG kiểm "dữ liệu này của ai")
□ Test bằng curl: ẩn danh → 401 · sai role → 403 · đúng role → 200
□ Cập nhật bảng ở mục 3 của file này
```
