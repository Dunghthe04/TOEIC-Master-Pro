# Kế hoạch phát triển — TOEIC Master Pro

> **Mở file này ra là biết hôm nay làm gì.** Mỗi ngày có danh sách việc cụ thể kèm file và lỗi cần sửa.
>
> 📍 **ĐANG Ở:** ✅ 8/8 lỗi chặn deploy · ✅ **Day 44–47 XONG** · 🟡 **Day 48 đang làm — 6/8 mục gốc
> xong** (lockout · hash refresh token · reuse detection · logout [Authorize] · **Google login khóa
> theo `sub`** · **bỏ ex.Message Google**) **+ 3 việc phát sinh xong** (bắt buộc xác thực email · gửi
> email thật qua Gmail SMTP · **vá user enumeration ở LoginAsync**) · **TIẾP THEO: quên mật khẩu đang
> hỏng hẳn** — `ForgotPasswordAsync` vẫn `Console.WriteLine`, việc "gửi mail thật" bỏ sót hàm này
> 🕒 Nhịp: 3–5 tiếng/ngày, **6 ngày/tuần + 1 ngày nghỉ**
> 📋 Chi tiết lỗi: [09](09-hien-trang-va-khuyen-nghi.md) · Công nghệ: [08](08-cam-nang-cong-nghe.md) · Phân quyền: [10](10-phan-quyen-endpoint.md) · **Máy mới: [11](11-thiet-lap-may-moi.md)**
>
> ⚠️ **Đang làm KHÔNG theo thứ tự Day** — ưu tiên 8 lỗi chặn deploy trước, mỗi lỗi tự đọc code xác
> nhận rồi tự sửa. Day 33 (đọc JD, quyết bản quyền) và Day 35–38 (tách DTO, giao diện 3 role) **chưa
> làm**, quay lại sau khi hết lỗi chặn deploy.
>
> ### Tiến độ 8 lỗi chặn deploy
>
> | # | Lỗi | Day | Trạng thái |
> |---|---|---|---|
> | 1 | Lộ đáp án cho người chưa đăng nhập | 34 | ✅ 2026-08-04 |
> | 2 | App không khởi động được ở Production | 39 | ✅ 2026-08-05 |
> | 3 | Secrets nằm trong git | 40 | ✅ 2026-08-05 |
> | 5 | Hangfire Dashboard mở cho tất cả | 41 | ✅ 2026-08-05 |
> | 6 | Redis kết nối đồng bộ lúc boot | 43 | ✅ 2026-08-05 |
> | 7 | docker-compose: PID/ports/password | 43 | ✅ 2026-08-05 |
> | 8 | File media hoàn toàn public | 41 | ✅ 2026-08-05 |
> | 4 | Stored XSS — 15 chỗ render HTML thô | 42 | ✅ **2026-08-06** |
>
> **🎯 Giai đoạn 1 hoàn tất.** Kế hoạch ghi *"giai đoạn 1 là điều kiện để có thể deploy"* — điều
> kiện đó đã đủ. Chi tiết cách vá + bài học: [09 — Phần 1](09-hien-trang-va-khuyen-nghi.md).
>
> **Còn nợ trước khi deploy thật:**
> - ⬜ Test UI luồng thi trên trình duyệt (signed URL media chỉ mới test bằng curl)
> - ⬜ Day 35–38: tách DTO theo người xem · giao diện 3 role (Admin chưa có UI)
> - ⬜ Day 44–49: auto-refresh token · khôi phục phiên khi F5 · lockout
> - ⬜ Day 33: đọc JD thật · quyết định bản quyền đề ETS
>
> ### 🔴 Việc PHẢI làm khi đổi máy — xem [11-thiet-lap-may-moi.md](11-thiet-lap-may-moi.md)
> Mười User Secrets (dùng `127.0.0.1`, **không** `localhost`) · `docker compose up -d
> --force-recreate` · di chuyển media sang `protected-media/` · SQL UPDATE 2 cột URL.
> Bỏ qua là app không boot, hoặc audio 404 hết.

---

## 🎯 Mục tiêu 42 ngày còn lại

Dự án này là **dự án mang đi phỏng vấn**, không phải startup. Mọi ngày dưới đây phục vụ một câu hỏi:

> *Khi người phỏng vấn chọn một luồng và hỏi "vì sao" năm lần liên tiếp, bạn trụ được tới câu thứ mấy?*

**Không có tính năng mới nào cho học viên.** Ngoại lệ duy nhất: **giao diện Admin** (Day 37–38) — vì
`PROJECT_DESCRIPTION.md` tuyên bố 3 role mà Admin hiện **không có một dòng giao diện nào**.
Còn lại: vá 123 lỗi đã tìm ra, deploy thật, viết test, đào sâu đúng chỗ nhà tuyển dụng .NET đào.

| Khối | Ngày | Kết quả đạt được |
|---|---|---|
| Phase 0 — Lấy dữ liệu thật | 33 | Biết JD thật yêu cầu gì; xử lý xong rủi ro bản quyền |
| Phase 1 — Đóng cửa + phân vai | 34–43 | Chạy được ở Production, hết lỗ hổng chặn deploy, **3 role có 3 giao diện thật** |
| Phase 2 — Ngừng làm hỏng bài thi | 44–49 | User thi trọn 2 tiếng không mất bài |
| Phase 3 — Deploy thật | 50–56 | Có `https://tenmien.com` chạy 24/7, có backup |
| Phase 4 — CI/CD | 57–60 | Push là test tự chạy, merge là tự deploy |
| Phase 5 — Application + Test | 61–67 | Tầng Application có nghiệp vụ thật, exam engine có test |
| Phase 6 — EF Core + Redis | 68–71 | Có số đo trước/sau, Redis có lý do tồn tại |
| Phase 7 — AI + Đóng gói | 72–74 | Sẵn sàng ngồi trước mặt người phỏng vấn |

### 👥 Ba role — ba trải nghiệm (chốt ở Day 36–38)

| Role | Trang chủ | Làm gì |
|---|---|---|
| **User** | `/dashboard` | Thi thử · xem lịch sử & tiến độ · luyện nhanh · từ vựng · **xem lịch thi TOEIC** |
| **ContentManager** | `/cm` | **Upload & quản lý đề thi** · câu hỏi · import Excel/ZIP · media · từ vựng |
| **Admin** | `/admin` | **Tổng quan hệ thống**: số user, số đề, số lượt thi · **quản lý tài khoản & role** |

---

## ⚙️ Bốn thói quen làm mỗi ngày

Quan trọng ngang nội dung. Không có chúng, sau 42 ngày bạn quên sạch nửa đầu.

| Khi nào | Việc | Vì sao |
|---|---|---|
| **Đầu ngày, 20–30′** | **Tự đọc code xác nhận lỗi còn tồn tại và đúng như mô tả** — trước khi sửa | Bản audit cũng do AI sinh. Đây chính là bài tập đọc code bạn đang thiếu, và dạy phản xạ: **không tin báo cáo, tin nguồn** |
| **Cuối ngày, 10′** | Rút **3 câu từ những ngày ĐÃ QUA**, trả lời **thành tiếng** | Viết ra thì vẫn nhìn được chữ. Nói to mới lộ chỗ chỉ nhớ mang máng |
| **Mỗi ngày, 30–45′** | **SQL viết tay trên giấy** + C# thuần + OOP/SOLID hỏi miệng | Quy trình tuyển thật: lọc CV → **bài test đầu vào** → mới tới phỏng vấn. Có dự án xuất sắc vẫn trượt ở vòng test |
| **Mỗi tuần, 1 lần** | Chọn **một tính năng cũ chưa từng đụng**, đọc hết, viết 10 dòng giải thích + 2 chỗ sẽ làm khác | 32 ngày code cũ cũng do AI sinh, mà đó là thứ hiện lên màn hình lúc demo |

**Quy ước commit mới — áp dụng từ Day 33:**
Commit **nhỏ theo ý định** (không theo ngày) · message viết **VÌ SAO** không viết LÀM GÌ · làm qua
**branch → PR → tự review có comment → merge** · bật branch protection.
*Lý do: lịch sử hiện tại (`feat: Day 31…`, `edit gitignore file`) đang tố cáo dự án làm theo giáo trình,
và rất nhiều interviewer mở tab Commits.*

---

# Phase 0 — Lấy dữ liệu thật (Day 33)

## Day 33 — Đọc JD thật · Quyết định bản quyền · Đổi quy ước git

```
□ Đọc 10–15 JD .NET junior đang tuyển thật (ITviec, TopCV, LinkedIn)
  → Lập bảng đếm tần suất: EF Core · SQL Server · React/Angular · Azure/on-prem
    · Docker · microservices · SignalR · unit test · tiếng Anh
  → Dùng bảng này để điều chỉnh 41 ngày còn lại

□ 🔴 QUYẾT ĐỊNH BẢN QUYỀN ĐỀ THI  ← xem cảnh báo bên dưới
  □ Soạn bộ đề demo tự viết: 10–20 câu mỗi Part (đủ để demo)
  □ Đề ETS thật: chỉ giữ local, hoặc để sau đăng nhập + noindex
  □ README ghi rõ: "TOEIC là nhãn hiệu của ETS. Dự án không liên kết,
    nội dung dùng cho mục đích học tập."

□ Đổi quy ước git: bật branch protection, từ giờ làm qua PR
□ Xóa package.json + package-lock.json ở thư mục gốc (rác, không ai dùng)
```

> ### 🔴 Vì sao bản quyền phải quyết ngay hôm nay
> DB đang có **1 đề TOEIC thật 200 câu kèm audio**. TOEIC là nhãn hiệu đã đăng ký của ETS.
>
> Rủi ro tệ nhất **không phải** takedown — mà là **interviewer từng ôn TOEIC sẽ nhận ra ngay đó là đề
> thật**. Thứ họ ghi nhớ về bạn sẽ thành câu hỏi về **phán đoán nghề nghiệp**, không còn là câu hỏi kỹ thuật.
>
> Ngược lại, xử lý sớm cho bạn một câu trả lời mà **rất ít ứng viên fresher nghĩ tới**:
> *"Em tách dữ liệu có bản quyền khỏi bản công khai vì…"*

---

# Phase 1 — Đóng cửa + phân vai (Day 34–43)

**Xong phase này:** `dotnet run --environment Production` chạy không crash · mọi endpoint không có
`[AllowAnonymous]` đều trả 401 khi gọi trần · và **đăng nhập bằng 3 tài khoản khác nhau ra 3 giao
diện khác nhau**.

> ### 📌 Hiện trạng phân quyền — cập nhật 2026-08-04
> **Quyền GHI an toàn từ đầu.** Mọi `POST/PUT/DELETE` đều có `[Authorize(Roles="Admin,ContentManager")]`.
>
> **Quyền ĐỌC — lỗ hổng chính, đã vá ở Day 34:**
>
> | Endpoint | Trước Day 34 | Sau Day 34 |
> |---|---|---|
> | `GET /api/Question`, `/{id}` | **Bất kỳ ai, không cần đăng nhập** — kèm `IsCorrect` + `Explanation` | Chỉ CM/Admin (401/403) |
> | `GET /api/Test`, `/{id}` | Ẩn danh — lộ đề nháp chưa publish | Chỉ CM/Admin |
> | `GET /api/Test/published`, `/{id}/structure` | Ẩn danh | Cần đăng nhập (học viên gọi được) |
> | `GET /api/Vocabulary` | Ẩn danh | Cần đăng nhập |
> | `GET /api/examschedule` | Ẩn danh | **Vẫn ẩn danh có chủ ý** — lịch thi công khai cho landing page |
>
> Bảng đầy đủ 10 controller: [10-phan-quyen-endpoint.md](10-phan-quyen-endpoint.md).
>
> **Còn lại của cụm 34–38:** Day 35 giấu đáp án khỏi User thường trong DTO · Day 36 tách menu & trang
> chủ theo role · Day 37–38 dựng giao diện Admin.
>
> ⚠️ **UX đang tệ hơn trước cho tới khi làm Day 36:** User thường bấm menu "Quản lý đề" giờ nhận **403
> trang lỗi** thay vì xem được. Đây là hệ quả biết trước, không phải lỗi mới.

## ✅ Day 34 — Fallback authorization policy — XONG 2026-08-04

```
✅ Program.cs:134-137 — fallback policy, mặc định ĐÓNG
✅ AuthController — [AllowAnonymous] cấp class + [Authorize] cho logout
✅ ExamScheduleController — [Authorize] cấp class + [AllowAnonymous] cho 3 GET công khai
✅ QuestionController — [Authorize(Roles="Admin,ContentManager")] cấp class,
   xóa 5 attribute cấp action đã trùng
✅ TestController — [Authorize] cấp class + siết Roles ở GetList/GetDetail
✅ VocabularyController — [Authorize] cấp class
✅ Bảng endpoint × role → docs/10-phan-quyen-endpoint.md
✅ Test curl: ẩn danh 401 · User 403 (Content-Length: 0) · Admin 200
```

**Ba việc trong kế hoạch gốc KHÔNG cần làm — đã tự kiểm chứng:**
- `/health/*` và `/.well-known/acme-challenge` **chưa tồn tại** → để Day 54/56
- Swagger nằm trong `if (IsDevelopment())` (`Program.cs:196-205`) và `UseSwagger` là **middleware**,
  không phải endpoint → fallback policy không chạm tới
- Callback Google OAuth: `POST /api/auth/google-login` đã được `[AllowAnonymous]` cấp class phủ

**Phát hiện mới trong lúc làm — quan trọng hơn cả checklist:**
> **Authorization KHÔNG áp dụng cho middleware terminal.** `app.UseStaticFiles()` (`:215`) và
> `app.UseHangfireDashboard()` (`:221`) tự xử lý request rồi trả về, **không bao giờ** chạm tới
> `UseAuthorization`. Bật fallback policy **không** làm hai chỗ này an toàn — vẫn public. Sửa ở Day 41.

**Hai cái bẫy đã va phải (giá trị phỏng vấn cao):**
1. `[Authorize]` **trần** vô nghĩa khi fallback policy đã là `RequireAuthenticatedUser` — cả hai đều
   là `RequireAuthenticatedUser`, không siết thêm gì. Phải ghi `Roles`.
2. **Xóa attribute cũ trước khi thêm cái mới** đã tạo ra cửa sổ User thường xóa được câu hỏi. Thứ tự
   an toàn: **thêm rồi mới xóa**.

**Lỗi vá được:** `GET /api/Question` ẩn danh trả `IsCorrect` + `Explanation` · `GET /api/test` lộ đề nháp · `/api/auth/logout` ẩn danh
**Câu phỏng vấn mở khóa:** *"Authorization trong ASP.NET Core hoạt động thế nào?"* · *"`FallbackPolicy` khác `DefaultPolicy` chỗ nào?"* · *"401 vs 403?"* · *"Bạn từng tìm thấy lỗ hổng bảo mật nào chưa?"*

## Day 35 — Tách DTO theo người xem

```
□ QuestionService.MapToResponse hiện trả IsCorrect + Explanation cho MỌI người gọi
  □ Tách QuestionForLearnerDto  — KHÔNG có IsCorrect, KHÔNG có Explanation
  □ Tách QuestionForManagerDto  — đầy đủ
  □ Service nhận biết role qua ICurrentUserService, trả đúng loại

□ Rà TestService.cs (440 dòng) tìm chỗ rò tương tự trong luồng lấy đề
□ Rà mass assignment: DTO có nhận thẳng field nhạy cảm không (role, plan, xpPoints)

□ Backend trả roles cho frontend (chuẩn bị cho Day 36):
  □ Thêm Roles vào DTO profile — UserManager.GetRolesAsync(user)
  → hiện KHÔNG response nào trả roles, nên frontend không thể biết user là ai
```

**Vì sao ngay sau Day 34:** Day 34 chặn người **chưa đăng nhập**; Day 35 chặn cả **tài khoản User thường**. Hai ngày này là một cặp.
**Câu phỏng vấn:** *"Defense in depth là gì, ví dụ trong dự án bạn?"* · *"Sao không dùng entity làm response?"*

## Day 36 — Tách giao diện theo role: User · CM · Admin

> ### 🎯 Thiết kế phân vai — chốt ở đây, ba ngày 36–38 làm theo bảng này
>
> | Role | Trang chủ sau đăng nhập | Menu được thấy | Nhiệm vụ |
> |---|---|---|---|
> | **User** | `/dashboard` | Dashboard · Thi thử · Lịch sử thi · Tiến độ · Luyện nhanh · Từ vựng · Lịch thi | **Học và thi** |
> | **ContentManager** | `/cm` | Đề thi · Câu hỏi · Import · Media · Từ vựng · Lịch thi | **Sản xuất nội dung** |
> | **Admin** | `/admin` | Tổng quan hệ thống · Quản lý tài khoản · (xem được cả menu CM) | **Nhìn toàn cảnh, quản người** |
>
> **Nguyên tắc phân vai:** CM **không** cần xem thống kê hệ thống; Admin **không** cần ngồi soạn câu
> hỏi. Ai làm việc nấy. Admin thấy thêm menu CM vì Admin là cấp trên của CM, nhưng **trang chủ khác nhau**.

```
□ frontend/src/types/auth.types.ts: thêm roles: string[] vào interface User
  → hiện User type KHÔNG có trường roles

□ Tạo lib/roles.ts — nguồn sự thật duy nhất về phân vai:
  □ hasRole(user, 'Admin') · isContentManager(user) · isAdmin(user)
  □ NAV_BY_ROLE: bảng menu theo role (thay 9 mục cố định hiện tại)
  □ HOME_BY_ROLE: User→/dashboard · CM→/cm · Admin→/admin

□ Sidebar.tsx: đọc NAV_BY_ROLE thay vì mảng navItems cứng
□ LoginPage: sau khi đăng nhập điều hướng theo HOME_BY_ROLE, không cứng /dashboard
□ Header.tsx: BỎ "XP · streak" cho CM và Admin
  → hiện hiện cho MỌI role, mà gamification đã cắt nên luôn là "0 XP · 0 ngày streak"
  → Admin đăng nhập vào thấy dòng đó là lộ ngay

□ Tạo components/auth/RequireRole.tsx, bọc route:
  □ /cm/*    → ContentManager hoặc Admin
  □ /admin/* → chỉ Admin
  → gõ thẳng URL cũng bị đá về trang chủ đúng role
  → ProtectedRoute hiện CHỈ kiểm tra đã đăng nhập, không kiểm role

□ Tạo pages/cm/CmHomePage.tsx — trang chủ CM (số đề, số câu hỏi, lối tắt import)
  → hiện CM đăng nhập vào rơi thẳng vào /dashboard của học viên

□ Xử lý 403 ở 5 trang CM còn lại (hiện chỉ TestFormPage.tsx có)
  → QuestionFormPage · QuestionListPage · QuestionImportPage
    · TestListPage · TestQuestionsPage
□ Thêm route 404 (hiện gõ URL sai ra trang trắng hoàn toàn)
```

**Vì sao PHẢI đi liền Day 34–35:** sau khi Day 34 khóa API, User thường bấm menu "Quản lý đề" sẽ nhận
**403 trang lỗi**. Không làm Day 36 ngay thì UX **tệ hơn hiện tại** — trước còn xem được, giờ ăn lỗi.

> ⚠️ **Nguyên tắc phải thuộc:** ẩn menu là **GIẤU**, chặn route là **KHÓA**, nhưng **cả hai chỉ là UX**.
> Bảo mật thật nằm ở `[Authorize]` phía server (Day 34). Frontend chạy trên máy người dùng — họ sửa
> được tất cả. **Không bao giờ tin frontend.**

**Câu phỏng vấn:** *"Phân quyền ở frontend có phải bảo mật không?"* — câu này rất hay dùng để loại ứng viên trả lời "có"

## Day 37 — Backend cho Admin: tổng quan hệ thống + quản lý tài khoản

```
□ Tạo AdminController — [Authorize(Roles = "Admin")] cấp class

□ GET /api/admin/overview — số liệu tổng quan:
  □ Tổng user · user mới 7 ngày qua · user đang hoạt động 30 ngày
  □ Số user theo role (User / ContentManager / Admin)
  □ Tổng đề thi (published / nháp) · tổng câu hỏi (theo Part)
  □ Tổng lượt thi · lượt thi 7 ngày qua · điểm trung bình toàn hệ thống
  □ Top 5 đề được làm nhiều nhất
  ⚠️ Viết bằng CountAsync / GroupBy DƯỚI SQL — đừng nạp cả bảng rồi đếm trong RAM
     (đây đúng là lỗi Repository đang mắc, sẽ sửa gốc ở Day 69)

□ GET /api/admin/users — danh sách tài khoản, phân trang + tìm theo email/tên
  □ Trả: email, họ tên, roles, ngày tạo, EmailConfirmed, trạng thái khóa
□ PUT /api/admin/users/{id}/roles — gán/thu role
  → dùng UserManager.AddToRoleAsync / RemoveFromRoleAsync
□ POST /api/admin/users/{id}/lock + /unlock — khóa/mở tài khoản
  → dùng UserManager.SetLockoutEndDateAsync

□ ⚠️ Chặn Admin tự thu quyền Admin của chính mình (tự khóa mình ra ngoài)
□ ⚠️ Chặn khóa tài khoản Admin cuối cùng còn lại
```

**Vì sao đáng 1 ngày:** đây là ngày duy nhất trong 42 ngày bạn dùng **`UserManager` / `RoleManager`
của ASP.NET Identity** ở mức sâu — vốn là kiến thức phỏng vấn hỏi được. Khác hẳn CRUD thường.

**Câu phỏng vấn:** *"Identity quản lý role thế nào?"* · *"Lockout hoạt động ra sao?"* · *"Làm sao chặn admin tự khóa mình?"*

## Day 38 — Giao diện Admin

```
□ Tạo pages/admin/AdminOverviewPage.tsx — trang chủ Admin tại /admin
  □ Hàng thẻ số liệu: user · đề thi · câu hỏi · lượt thi
  □ Biểu đồ user mới theo ngày (Recharts — đã dùng ở /dashboard, tái dùng)
  □ Bảng top 5 đề được làm nhiều nhất
  ⚠️ Chart từ 2 series trở lên thì dùng bộ màu đã kiểm chứng:
     #2f7fc4 / #7c3aed / #d97706 — KHÔNG dùng #1a4d7c làm màu đường/cột
     (quá tối + quá xám, trượt check mù màu; chỉ hợp làm màu header/chữ)

□ Tạo pages/admin/AdminUserListPage.tsx — quản lý tài khoản tại /admin/users
  □ Bảng: email · họ tên · role (badge) · ngày tạo · trạng thái
  □ Ô tìm kiếm + phân trang
  □ Nút gán/thu role (dialog xác nhận)
  □ Nút khóa/mở tài khoản (dialog xác nhận)

□ Tạo services/admin.service.ts + types/admin.types.ts
□ Đăng ký route /admin và /admin/users, bọc RequireRole('Admin')
```

**Xong Day 38:** đăng nhập bằng 3 tài khoản khác nhau ra **3 trang chủ khác nhau, 3 menu khác nhau**.
Lời tuyên bố "3 role" trong `PROJECT_DESCRIPTION.md` **thành thật**.

> ### 💰 Cái giá của 3 ngày này — nói thẳng
> Day 36–38 lấy **2 ngày** khỏi phần bảo mật/test/EF Core (kế hoạch giãn từ Day 72 → **Day 74**).
>
> **Đáng hay không?** Đáng, vì hai lý do:
> 1. Hiện tại `PROJECT_DESCRIPTION.md` tuyên bố **3 role** nhưng Admin **không có một dòng giao diện
>    nào**. Interviewer nói *"cho tôi xem giao diện admin"* là không có gì để mở — đó là **khoảng cách
>    giữa điều bạn nói và điều bạn có**, khó đỡ hơn lỗi kỹ thuật.
> 2. Day 37 là ngày duy nhất bạn đụng sâu vào `UserManager`/`RoleManager` — kiến thức Identity mà
>    phỏng vấn .NET hỏi thật.
>
> **Nếu phải cắt bớt:** cắt biểu đồ ở Day 38, giữ bảng số liệu + quản lý tài khoản. Đừng cắt Day 37.

## Day 39 — Cấu hình fail-fast 🔴

```
□ Xóa TOÀN BỘ null-forgiving `!` trong Program.cs:
  □ Program.cs:64  builder.Configuration["Redis:ConnectionStrings"]!
  □ Program.cs:101 GetSection(JwtSettings.SectionName).Get<JwtSettings>()!

□ Chuyển sang Options pattern có validation:
    builder.Services.AddOptions<JwtSettings>()
        .Bind(builder.Configuration.GetSection(JwtSettings.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();
  □ JwtSettings · RedisSettings · CorsSettings · GoogleAuthSettings
  □ Thêm [Required], [MinLength(32)] cho SecretKey

□ Tạo appsettings.Production.json làm template (placeholder, KHÔNG có secret)
□ Thêm AddSecurityDefinition("Bearer") cho Swagger — hiện không test được endpoint [Authorize]

□ KIỂM CHỨNG: dotnet run --environment Production
  → phải báo "thiếu cấu hình Jwt" rõ ràng, KHÔNG phải NullReferenceException
```

**Lỗi vá được:** app không khởi động được ở Production
**Câu phỏng vấn:** *"Configuration .NET, thứ tự ưu tiên nguồn?"* · *"IOptions vs IOptionsSnapshot vs IOptionsMonitor?"* · fail-fast

## Day 40 — Đuổi secret khỏi git 🔴

```
□ Sinh SecretKey MỚI:  openssl rand -base64 48
  → hiểu hệ quả: mọi token đang lưu hành sẽ vô hiệu

□ Đổi toàn bộ mật khẩu: SQL sa, Redis, tài khoản Admin seed
□ dotnet user-secrets init + set cho môi trường dev
□ Production đọc từ biến môi trường (Jwt__SecretKey — hai gạch dưới thay dấu :)

□ git rm --cached backend/ToeicMasterPro.API/appsettings.Development.json
□ Thêm vào .gitignore
□ Tạo appsettings.Development.example.json (chỉ tên khóa, giá trị rỗng)
□ Bỏ connection string sa khỏi appsettings.json (file base, nạp ở MỌI môi trường)

□ Dọn .env ở thư mục gốc: 13/15 biến là cấu hình chết, 2 biến ghi sai port/tên DB

□ Ghi lại quyết định: KHÔNG viết lại lịch sử git (rủi ro cao, ít lợi) mà xoay khóa
  → giải thích được vì sao lựa chọn đó hợp lý
```

**Câu phỏng vấn:** *"Secret lỡ commit vào git thì xử lý sao?"* — biết xóa file **không đủ**, phải rotate; biết vì sao lộ khóa HS256 là ai cũng tự ký được token Admin

## Day 41 — Middleware order + khóa media + Hangfire

```
□ ⚠️ CÁI BẪY: UseStaticFiles đứng trước UseAuthentication (Program.cs:215)
  → ĐỔI CHỖ LÀ CHƯA ĐỦ. Static file middleware KHÔNG tham gia authorization
    dù đặt ở đâu trong pipeline.
  □ Giải pháp thật: chuyển audio/ảnh đề thi RA KHỎI wwwroot công khai
  □ Phục vụ qua MediaController (đã có sẵn) với [Authorize] + kiểm quyền
  □ wwwroot chỉ giữ tài nguyên thật sự công khai (avatar)

□ Hangfire Dashboard (Program.cs:221) — hiện KHÔNG có authorization, nằm NGOÀI
  khối IsDevelopment
  □ Viết AdminOnlyDashboardFilter : IDashboardAuthorizationFilter
  □ Gắn vào UseHangfireDashboard, đặt SAU UseAuthentication/UseAuthorization

□ Dọn: AddHttpContextAccessor() gọi hai lần (Program.cs:92 và :169)
```

**Câu phỏng vấn:** *"Middleware pipeline, thứ tự quan trọng thế nào?"* — trả lời có chiều sâu vì bạn đã va vào cái bẫy này

## Day 42 — XSS + nơi lưu token 🔴

```
□ dotnet add package HtmlSanitizer
□ Sanitize ở BACKEND lúc GHI (không chỉ frontend — frontend bỏ qua được):
  □ QuestionService: Content, Explanation, Passage
  □ 15 chỗ dangerouslySetInnerHTML ở FE giờ an toàn

□ Chuyển access token khỏi localStorage:
  □ Access token → giữ trong memory (biến JS)
  □ Refresh token → httpOnly cookie (hoặc giữ localStorage nếu chưa kịp)
  → giảm thiệt hại nếu XSS lọt lưới

□ Import ZIP (TestController.cs:177-198) — hiện giải nén file BẤT KỲ đuôi nào
  vào wwwroot → ghi được HTML/JS lên chính origin của API
  □ Whitelist đuôi file: .mp3 .m4a .jpg .jpeg .png
  □ Giới hạn số entry + tổng dung lượng giải nén (chống zip bomb)

□ MediaController (:44-77): kiểm nội dung file thật (magic bytes), không chỉ tin
  phần mở rộng; không ghi đè im lặng
```

**Câu phỏng vấn:** *"XSS là gì? React tự chống chưa? `dangerouslySetInnerHTML` phá vỡ điều đó thế nào?"* · *"Token lưu ở đâu là an toàn?"*

## Day 43 — docker-compose production + Redis boot

```
□ Tạo docker-compose.prod.yml:
  □ MSSQL_PID=Express        ← BẮT BUỘC. Developer edition CẤM dùng production
  □ BỎ HẲN mục ports của sqlserver và redis (chỉ nói chuyện nội bộ Docker)
    → hiện đang bind 0.0.0.0, comment ghi "chỉ expose local" là SAI
  □ BỎ hardcode mật khẩu fallback ${DB_PASSWORD:-ToeicMaster@2026}
    → đang vô hiệu hóa hoàn toàn việc gitignore .env
  □ Volume cho media — không có thì mọi file upload MẤT SẠCH mỗi lần deploy lại

□ Redis connect qua factory lambda (Program.cs:66) — hiện connect ĐỒNG BỘ lúc boot
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
        ConnectionMultiplexer.Connect(redisConn));
  □ Thêm abortConnect=false vào connection string

□ EnableRetryOnFailure cho DbContext (Program.cs:35) — quan trọng khi lên VPS
□ Gỡ Serilog.AspNetCore khỏi Infrastructure.csproj (không dòng code nào ở tầng đó dùng)
```

**Câu phỏng vấn:** *"Vì sao không expose port DB ra ngoài?"* · licensing SQL Server · transient fault

---

# Phase 2 — Ngừng làm hỏng bài thi của user (Day 44–49)

**Xong phase này:** user thi trọn 2 tiếng không bị đá ra, F5 không mất bài, dữ liệu bẩn không chặn nộp bài.

## Day 44 — Auto-refresh token 🔴 (lỗi UX nặng nhất)

```
□ axios interceptor: gặp 401 thì GỌI REFRESH, không phải đá về /login
  → Backend CÓ /api/auth/refresh, frontend CÓ lưu refresh token,
    nhưng CHƯA BAO GIỜ dùng đến

□ Chống refresh token race: nhiều request cùng 401 → cùng gọi refresh
  → token rotation làm các lần sau thất bại
  □ Một promise refresh dùng chung, request khác xếp hàng chờ rồi retry

□ Logout gọi API thật (POST /api/auth/logout) trước khi xóa local state
  → hiện FE chỉ xóa localStorage, refresh token sống tiếp 30 ngày trong DB

□ Xóa code chết: nhánh xử lý 401 trong các page không bao giờ chạy được
  (MockTestPlayPage.tsx:180, VocabularyPage.tsx:131)
```

**Con số:** access token **60 phút** · bài thi TOEIC **~2 tiếng** → **chắc chắn xảy ra** với mọi user thi full test
**Chữa cháy tạm nếu chưa kịp:** nâng `AccessTokenExpiryMinutes` lên 180

## Day 45 — Khôi phục phiên thi khi F5 — ✅ XONG 2026-08-10

```
☑ ⚠️ TỰ KIỂM CHỨNG TRƯỚC: đáp án ĐÃ được debounce-save lên server rồi
  → ĐÚNG. Xác nhận bằng DB: phiên InProgress có đáp án ngay trong lúc thi.

☑ StartAsync IDEMPOTENT thay vì thêm endpoint GET riêng — frontend vốn đã gọi
  start lúc mount, nên chỉ cần server trả thêm dữ liệu là F5 tự khỏi.
  Khớp (UserId, TestId, PartsFilter): dở Part 5,6,7 vs full đề là HAI bài khác nhau.
☑ BỎ sessionStorage của kế hoạch gốc — chết khi đóng tab, không chung giữa các
  tab, mất khi đổi máy. Server làm nguồn sự thật thì đúng ở mọi tình huống.
☑ Thêm cột ReadingStartedAt + POST /{id}/reading-start (ghi MỘT LẦN, không ghi đè)
☑ Phiên quá hạn → tự Abandoned + cấp phiên mới, không nhốt user trong bài chết
□ .catch(() => {}) nuốt lỗi lưu đáp án — DOC LỆCH CODE, chỗ này đã có toast từ trước

⚠️ Ba cái bẫy chỉ lộ khi chạy thật — xem 09 mục 2.2:
   hai lối vào Reading · thứ tự nhánh khôi phục · flushSaveAnswers chặn submit
```

## Day 46 — Ràng buộc thời gian phía server — ✅ XONG 2026-08-10 (gộp với Day 45)

```
☑ Hạn = min(ReadingStartedAt + 80', StartedAt + 24h)
☑ CHẶN Ở SaveAnswers, không chỉ ở Submit — phiên hết giờ VẪN đang InProgress,
  nên không chặn ghi thì user thi hôm nay mai mở lại làm tiếp rồi nộp
☑ SubmitAsync: quá hạn VẪN CHẤM (không từ chối), CompletedAt = thời điểm hết hạn
  → từ chối sẽ phạt oan người mất mạng đúng lúc hết giờ + kẹt phiên vĩnh viễn
☑ readingSecondsLeft do server tính, client chỉ hiển thị (CWE-602)
☑ Client tự sửa lệch đồng hồ: lưu thất bại → hỏi lại server → về 0 → tự nộp

QUYẾT ĐỊNH: Listening KHÔNG bó giờ. ETS quy định 45' nhưng thực thi BẰNG CUỐN BĂNG,
không bằng đồng hồ. App dùng new Audio() không controls, và trình duyệt vẫn phát
đúng tốc độ ở tab nền — băng chính là đồng hồ. Reading không có gì điều nhịp nên
bắt buộc neo server. Phân tích đầy đủ + nguồn ETS/CWE: 09 mục 2.2.
```

## ✅ Day 47 — Vá 2 lỗ logic phá hoại nghiệp vụ — XONG 2026-08-19

```
☑ Import Excel (QuestionService.cs:218-233) tạo được câu hỏi KHÔNG có đáp án đúng
  → SubmitAsync gặp câu đó trả lỗi CHO CẢ BÀI THI
  → CM sai một ô Excel = MỌI user làm đề đó không nộp bài được, VĨNH VIỄN
  ☑ Dùng chung Validate() cho luồng import
  ☑ Dòng nào sai thì bỏ qua + báo cáo, không tạo

☑ POST /api/practice/submit (PracticeService.cs:69-114) chấm BẤT KỲ questionId nào
  → user đang thi lấy questionId từ màn hình, gửi vào đây = MÁY TRA ĐÁP ÁN
  ☑ Tạo phiên practice có state, chỉ chấm câu thuộc phiên đó

☑ SaveAnswers: dedupe questionId trùng trong 1 payload (hiện → 500)
  → TestSessionService.cs SaveAnswersAsync: dictionary "existing" chỉ phản ánh DB,
    không cập nhật theo item vừa xử lý trong loop — payload có 2 item cùng
    QuestionId thì cả 2 đều rơi vào nhánh insert → vi phạm unique index
    (SessionId, QuestionId) → DbUpdateException → 500 chung.
  ☑ Fix: GroupBy(QuestionId).Select(g => g.Last()) trước khi loop — giữ giá trị
    chọn SAU CÙNG (mới nhất), dedupe hết trùng lặp trước khi đụng DB.

☑ SaveAnswers: kiểm SelectedOptionId có thuộc đúng QuestionId đó không
  → Trước đây lưu thẳng SelectedOptionId không đối chiếu ngược QuestionId —
    GUID rác (không tồn tại) → FK vi phạm → 500; GUID thật nhưng thuộc CÂU KHÁC
    → lưu thành công nhưng thành rác dữ liệu (không phải lỗ hổng điểm số vì GUID
    không đoán được, nhưng review sau này dễ hiện sai đáp án).
  ☑ Fix: dựng map QuestionId → HashSet<OptionId> hợp lệ, chặn trước khi ghi.

☑ Sửa/xóa Question đã có người trả lời → bắt DbUpdateException, trả 400 có thông báo
  (hiện nổ FK Restrict → 500)
  → QuestionService.cs UpdateAsync/DeleteAsync: FK Restrict giữa TestSessionAnswer
    ↔ Question/QuestionOption (TestSessionAnswerConfiguration.cs:30-38) — hễ có
    1 người từng chọn/trả lời câu đó (kể cả phiên bỏ dở) là CM không sửa/xóa được
    NỮA, luôn ăn 500 từ GlobalExceptionHandler, không rõ vì sao.
  ☑ Fix: try/catch DbUpdateException quanh SaveChangesAsync ở cả 2 hàm, trả
    Result.Failure(...) → controller map thành 400 kèm thông báo rõ nguyên nhân.

Kiểm chứng: build sạch (0 lỗi) + 30 test có sẵn vẫn pass (không có test riêng
cho 2 service này — Testcontainers/characterization test để Day 61-62).
```

## 🟡 Day 48 — Siết authentication — ĐANG LÀM, 6/8 xong — 2026-08-20

```
📍 ĐANG Ở: mục 1-6 đã vá + build sạch + 30 test pass. Còn mục 7 (Register
   enumeration) + mục 8 (validation DTO, mô tả gốc SAI — xem bên dưới).
   TIẾP THEO ưu tiên hơn cả 2 mục đó: ForgotPasswordAsync vẫn Console.WriteLine
   → chức năng quên mật khẩu HỎNG HẲN với user thật, mà UI vẫn báo thành công.

☑ Lockout khi sai mật khẩu — XONG 2026-08-20
  ☑ LoginAsync đổi CheckPasswordAsync → SignInManager.CheckPasswordSignInAsync(
    ..., lockoutOnFailure: true) — KHÔNG dùng PasswordSignInAsync vì hàm đó issue
    thêm cookie đăng nhập của Identity, app chỉ dùng JWT tự cấp
  ☑ Program.cs: options.Lockout.MaxFailedAccessAttempts=5, DefaultLockoutTimeSpan=15'
  ☑ Kiểm chứng tay: sai 5 lần → khóa 15 phút, đúng mật khẩu trong lúc khóa vẫn bị chặn

☑ Refresh token: lưu SHA-256 thay vì plaintext — XONG 2026-08-20
  ☑ TokenService.GenerateRefreshToken trả (Entity, RawToken) — Entity.Token = hash
    (SHA-256, KHÔNG cần salt/chậm hoá vì input đã là 64 byte ngẫu nhiên thật),
    RawToken mới là giá trị gửi client. Không cần migration (cột đã MaxLength 200).
  ☑ RefreshTokenAsync/LogoutAsync: hash refreshToken nhận được rồi mới so với DB
  ⚠️ Hệ quả 1 lần: mọi refresh token đang lưu hành TRƯỚC khi deploy tự vô hiệu
    (giống rotate Jwt:SecretKey ở Day 40) — mọi người bị đá về login 1 lần

☑ Refresh token: reuse detection — XONG 2026-08-20
  ☑ RefreshTokenAsync: token có RevokedAt != null (đã bị revoke, KHÁC hết hạn tự
    nhiên) mà vẫn bị dùng lại → thu hồi TOÀN BỘ token đang hoạt động của user đó
    (không chỉ token vừa dùng) + log cảnh báo (ILogger, chỉ để audit, không phải
    hàng phòng vệ chính — hàng phòng vệ chính là thu hồi cả họ)
  ⚠️ Giới hạn đã biết: race 2 tab cùng lúc với token cũ CÓ THỂ bị nhận nhầm reuse
    (đánh đổi có chủ ý của kỹ thuật rotation+reuse-detection)

☑ /api/auth/logout: thêm [Authorize] + kiểm quyền sở hữu token — XONG 2026-08-20
  ☑ [Authorize] đè [AllowAnonymous] cấp class — FE không cần sửa gì (Bearer
    accessToken vẫn còn lúc gọi logout, state chỉ xóa ở finally SAU khi gọi API)
  ☑ LogoutAsync nhận thêm userId (từ ICurrentUserService qua controller),
    chỉ revoke nếu stored.UserId == userId — không tạo oracle (response giống
    nhau dù token không tồn tại hay không thuộc user gọi)

☑ Google login: khóa theo `sub` thay vì email — XONG 2026-08-20

  VẤN ĐỀ: GoogleLoginAsync gộp tài khoản CHỈ bằng email → pre-hijack account
  takeover. Kẻ tấn công /register trước bằng email nạn nhân (mật khẩu tự đặt) →
  nạn nhân bấm "Đăng nhập bằng Google" → FindByEmailAsync tìm thấy tài khoản có
  sẵn → cấp JWT vào tài khoản do kẻ tấn công kiểm soát.
  ⚠️ RequireConfirmedEmail (việc phát sinh bên dưới) KHÔNG chặn được đường này —
    tưởng chặn rồi là hiểu sai: cờ đó do SignInManager thi hành, mà GoogleLoginAsync
    KHÔNG gọi SignInManager, nó đi thẳng FindByEmailAsync → BuildAuthResponseAsync.
    Cờ đó chỉ chặn bước "kẻ tấn công tự dùng mật khẩu", còn PasswordHash vẫn nằm
    trong DB làm BOM HẸN GIỜ: hôm nào EmailConfirmed bật lên là mật khẩu đó sống
    lại. Mà chính nạn nhân sẽ bật nó — mail xác nhận ở bước 1 gửi vào hộp thư của
    họ, nội dung hợp lệ, họ bấm là xong.

  GIẢI QUYẾT: `sub` (Google Account ID — bất biến, không bao giờ cấp lại) làm KHÓA
  ĐỊNH DANH; email hạ xuống thành THUỘC TÍNH.
  ☑ FindByLoginAsync("Google", payload.Subject) làm đường tìm CHÍNH
  ☑ AddLoginAsync ghi ánh xạ vào AspNetUserLogins cho MỌI nhánh (kể cả user cũ) —
    code cũ chưa bao giờ gọi hàm này nên bảng đó đang RỖNG, mỗi lần login lại SUY
    LUẬN từ email. Không cần migration (bảng có từ InitialCreate).
    → PK là cặp (LoginProvider, ProviderKey) nên "một sub chỉ trỏ tới 1 user" là
      ràng buộc DB CƯỠNG CHẾ, không phải quy ước code. Đây là lý do phải kiểm
      addLogin.Succeeded (Identity trả lỗi LoginAlreadyAssociated).
  ☑ Kiểm payload.EmailVerified — Google CÓ phát hành token với cờ này false, khi đó
    email không chứng minh được quyền sở hữu, mà cả logic dưới đều dựa vào điều đó
  ☑ Ba nhánh khi `sub` chưa liên kết mà email đã bị giữ — phân biệt bằng đúng một
    câu hỏi: "tài khoản này đã từng CHỨNG MINH nó sở hữu email chưa?"
    · không mật khẩu             → user Google cũ (chỉ luồng Google tạo được tài
                                   khoản không mật khẩu) → nhận vào + gắn sub
    · có mật khẩu + CHƯA xác thực → squat: Google vừa chứng minh sở hữu, bên đặt
                                   mật khẩu chưa chứng minh gì → bên chứng minh
                                   được THẮNG: RemovePasswordAsync +
                                   EmailConfirmed=true + thu hồi hết refresh token
                                   + log cảnh báo
    · có mật khẩu + ĐÃ xác thực   → chính chủ thật → TỪ CHỐI, không tự gộp

  🔴 KẾ HOẠCH GỐC GHI THIẾU 2 NHÁNH. Làm y nguyên "trùng email chưa liên kết → TỪ
    CHỐI thẳng" thì gây 2 sự cố:
    1. Khóa cửa với TOÀN BỘ user Google hiện có — AspNetUserLogins đang rỗng nên
       với họ FindByLoginAsync cũng trả null y như kẻ tấn công → từ chối vĩnh viễn
    2. Nạn nhân bị khóa vĩnh viễn khỏi email của CHÍNH MÌNH — tài khoản squat vẫn
       nằm đó, nạn nhân nhận "hãy đăng nhập bằng mật khẩu" mà họ không biết mật
       khẩu → kẻ tấn công thắng theo kiểu DoS thay vì takeover
    → BÀI HỌC: "từ chối" là phản xạ an toàn nhưng KHÔNG miễn phí. Chọn nó phải hỏi
      thêm một câu: "từ chối thì AI bị chặn oan?"

  ⚠️ Hệ quả có chủ ý: tài khoản seed Admin/CM (có mật khẩu + EmailConfirmed=true)
    rơi vào nhánh 3 → KHÔNG đăng nhập Google được nữa. Đúng, không phải lỗi: tài
    khoản quyền cao nhất càng không được để một luồng tự-gộp chạm vào.

☑ Bỏ ex.Message của Google trả ra client — XONG 2026-08-20
  VẤN ĐỀ: message của Google nói rõ token sai ở ĐÂU (audience/issuer/thời điểm hết
  hạn) → trả ra client là đưa kẻ tấn công bản hướng dẫn sửa token cho đúng.
  GIẢI QUYẾT: _logger.LogWarning(ex, ...) giữ chi tiết cho mình debug, client chỉ
  nhận "Token Google không hợp lệ."

⬜ Register: bỏ "Email đã được sử dụng" → thống nhất chống user enumeration
  ⚠️ Đổi chữ là chưa đủ — phải làm response GIỐNG HỆT nhau ở cả 2 trường hợp: email
    đã tồn tại thì VẪN trả Success, nhưng gửi vào hộp thư đó một mail khác ("có
    người vừa thử đăng ký bằng email của bạn") → vừa bịt đường dò, vừa CẢNH BÁO
    chính nạn nhân của kịch bản pre-hijack ở trên
  ⚠️ Cùng họ vấn đề với việc phát sinh "vá enumeration ở LoginAsync" (đã xong) —
    vá một chỗ mà bỏ chỗ kia thì coi như chưa vá
⬜ Thêm validation cho DTO auth
  🔴 MÔ TẢ GỐC SAI: "null/rỗng đi thẳng vào Identity gây 500" — đã tự kiểm, KHÔNG
    500 ở đâu cả:
    · cả 5 project bật <Nullable>enable</Nullable> → tham số string non-nullable
      trong positional record được coi là [Required] NGẦM → null/thiếu field bị
      [ApiController] chặn thành 400 TỰ ĐỘNG, không vào tới Identity
    · RequireUniqueEmail=true (Program.cs:66) → UserValidator của Identity CÓ kiểm
      định dạng email → gõ "abc" làm email bị chặn
    · chuỗi rỗng "" thì lọt thật, nhưng ra FindByEmailAsync("") → null → thông báo
      chung. Vẫn không 500.
  → HẠ xuống việc DỌN DẸP, làm sau cùng: thêm [MaxLength] cho FullName (đang là
    nvarchar(max), post tên 10MB được) + [EmailAddress] để lỗi hiện ở tầng DTO thay
    vì tầng Identity. 7 DTO auth hiện không có một attribute nào.

### Phát sinh ngoài 8 mục gốc — lộ ra khi test tay + khi đọc lại code sau mục 5

☑ LoginAsync để BẤT KỲ AI dò được email nào có tài khoản — XONG 2026-08-20

  VẤN ĐỀ: chính mục 1 + việc phát sinh RequireConfirmedEmail đã TẠO RA lỗ này.
  Sau khi thêm 2 thứ đó, LoginAsync trả 3 thông báo phân biệt được:
    "Tài khoản tạm khóa…"        → tài khoản TỒN TẠI
    "Email chưa được xác thực"   → tài khoản TỒN TẠI + chưa xác thực
    "Email hoặc mật khẩu không đúng" → không tồn tại HOẶC tồn tại+đã xác thực
  Cái ở giữa mới là lỗ: SignInManager chạy PreSignInCheck(user) TRƯỚC khi kiểm mật
  khẩu, và IsNotAllowed sinh ra từ chính PreSignInCheck đó → nó trả về BẤT KỂ mật
  khẩu đúng hay sai. Gõ email nạn nhân + mật khẩu rác "aaa" là biết chắc email đó
  có tài khoản.

  🔴 COMMENT TRONG CODE ĐANG NÓI SAI — đây là lý do lỗ này tồn tại mà không ai
    thấy: comment cũ viết "IsNotAllowed = mật khẩu ĐÚNG nhưng RequireConfirmedEmail
    chặn". Sai. Comment nói sai làm người đọc lại tin là đã an toàn.
    → Bằng chứng không cần tra tài liệu: chính mục 1 đã kiểm tay "đúng mật khẩu
      trong lúc khóa VẪN bị chặn". Nếu mật khẩu được kiểm trước thì mật khẩu đúng
      phải ra Succeeded. Nó ra LockedOut ⟹ PreSignInCheck chạy trước ⟹ mọi thứ
      trong PreSignInCheck (gồm IsNotAllowed) đều chạy trước. Test cũ của mình đã
      chứa sẵn câu trả lời, chỉ là lúc đó chưa đọc ra.

  GIẢI QUYẾT: chỉ nói thật với người CHỨNG MINH được là họ biết mật khẩu.
  ☑ Nhánh IsNotAllowed: gọi thêm _userManager.CheckPasswordAsync(user, password)
    (chỉ so hash, KHÔNG đi qua PreSignInCheck) → đúng thì mới trả "Email chưa được
    xác thực", sai thì trả thông báo chung. User thật vẫn được hướng dẫn đúng,
    người dò bừa không học được gì.
  ☑ Viết lại comment sai ở trên cho đúng cơ chế

  ⚠️ CỐ Ý KHÔNG che "Tài khoản tạm khóa…" dù nó cũng rò: muốn khóa được một tài
    khoản thì phải sai mật khẩu 5 lần, mà email không tồn tại đã bị chặn từ dòng
    `user is null` nên không bao giờ vào được trạng thái khóa. Che đi thì user thật
    bị khóa 15' mà không hiểu vì sao → đánh đổi ngược, mất nhiều hơn được.
    Câu phỏng vấn tự mở ra: "vì sao bạn che chỗ này mà không che chỗ kia?"

☑ RequireConfirmedEmail=true — XONG 2026-08-20
  → Test tay phát hiện: đăng ký bằng email KHÔNG PHẢI của mình vẫn được, dùng
    ngay được luôn — đây chính là bước 1 của kịch bản pre-hijack ở trên (đăng ký
    chiếm email người khác). Không xác thực email thì tài khoản chỉ chờ sẵn.
  ☑ Program.cs: options.SignIn.RequireConfirmedEmail = true
  ☑ LoginAsync: thêm nhánh signInResult.IsNotAllowed (mật khẩu đúng, email chưa
    xác thực) — PHẢI kiểm trước Succeeded, không thì lọt xuống báo nhầm "sai mật khẩu"
  ⚠️ Vá được lỗ hổng A (chiếm email bằng đăng ký tay) nhưng KHÔNG vá lỗ hổng B
    (Google login) — GoogleLoginAsync gọi thẳng BuildAuthResponseAsync, không đi
    qua CheckPasswordSignInAsync nên cờ này không chặn được đường Google. Vẫn
    cần làm mục "Google login" ở trên để đóng nốt.

☑ Link xác nhận qua email (thay vì bắt tự gọi API bằng Postman) — XONG 2026-08-20
  ☑ appsettings.json: thêm "Frontend:BaseUrl"
  ☑ RegisterAsync: build link `{BaseUrl}/confirm-email?userId=...&token=...`
    (Uri.EscapeDataString token — token Identity chứa +/=, vỡ link nếu không encode)
  ☑ Frontend: trang mới ConfirmEmailPage.tsx (route /confirm-email) đọc query
    string, tự gọi authService.confirmEmail(), hiện kết quả

☑ Gửi email THẬT qua Gmail SMTP (MailKit) — XONG 2026-08-20
  ☑ AuthService giờ inject IEmailSender (trước đó RegisterAsync Console.WriteLine
    thẳng, không qua abstraction — sửa luôn cho nhất quán)
  ☑ SmtpSettings.cs + SmtpEmailSender.cs (MailKit, StartTls port 587)
  ☑ Program.cs: đổi đăng ký IEmailSender từ ConsoleEmailSender → SmtpEmailSender
  ⬜ CẦN BẠN LÀM Ở MÁY KHÁC: điền appsettings.json Smtp:FromEmail/Username +
    dotnet user-secrets set "Smtp:Password" "<app-password-16-ký-tự>"
    (tạo tại myaccount.google.com/apppasswords, cần bật 2-Step Verification trước)
    → THIẾU BƯỚC NÀY thì gửi mail sẽ lỗi (chưa test end-to-end gửi mail thật)
☑ Rate limit policy "auth": tách riêng login, đừng bóp nghẹt cả refresh-token và logout
  → LÀM SỚM 2026-08-08 vì nó nổ ra khi test tay Day 44: F5 3 lần là bị đá về /login.
    Thêm policy "auth-refresh" 30/phút; refresh-token + logout đè ở CẤP ACTION,
    giữ "auth" ở cấp class làm mặc định siết (fail-closed).
  ✅ Kiểm chứng 2026-08-08: F5 15 lần không 429; sai mật khẩu 6 lần VẪN ra 429
    (nới refresh-token không nới nhầm login). Chi tiết: 09 mục 2.9

☑ 429 phải có thông báo riêng — LÀM SỚM 2026-08-08, lộ ra khi test ca "sai mật khẩu
  6 lần": rate limiter trả body RỖNG nên UI hiện "Email hoặc mật khẩu không đúng"
  → user tưởng gõ sai nên thử lại, mà thử lại đúng là thứ đang bị chặn.
  □ Program.cs: OnRejected trả { error } + header Retry-After
  □ LoginPage/AuthDialog: tách googleError khỏi serverError (dùng chung một biến
    nên lỗi nút Google hiện trên nút Đăng nhập của form mật khẩu)
```

## Day 49 — Dọn nốt Phase 2 + đệm

```
□ Hangfire cron chạy sai giờ: "30 0 * * *" hiểu theo UTC → thực tế 07:30 giờ VN
  □ Truyền TimeZoneInfo vào RecurringJobOptions

□ ExamReminderService (:41-67): gửi mail TRƯỚC khi commit EmailSent = true
  → SaveChanges lỗi sau khi mail đã gửi = lần sau GỬI TRÙNG
  □ Commit trước khi gửi, hoặc dùng outbox pattern
  □ Đổi điều kiện ExamDate.Date == hôm nay+3 thành khoảng <= hôm nay+3
    (hiện job lỡ một ngày là MẤT HẲN lượt nhắc)

□ iCal injection: escape RegisterUrl khi sinh file .ics (ExamScheduleService.cs:144)
□ Phân biệt mã lỗi HTTP: hiện MỌI lỗi nghiệp vụ trả 400
  □ 401 chưa đăng nhập · 403 không có quyền · 404 không tìm thấy
  → hiện "phiên thi không thuộc tài khoản này" trả 400 = lộ sự tồn tại tài nguyên người khác

□ NGÀY ĐỆM — nếu Phase 2 tràn thì dùng ngày này
```

---

# Phase 3 — Deploy thật (Day 50–56)

**Xong phase này:** có `https://tenmien.com` người khác mở được, chạy 24/7, backup **đã diễn tập khôi phục**.

## Day 50 — Dockerfile

```
□ backend/Dockerfile — multi-stage
  □ Stage build: mcr.microsoft.com/dotnet/sdk:8.0
  □ Stage runtime: mcr.microsoft.com/dotnet/aspnet:8.0
  □ COPY *.csproj TRƯỚC, dotnet restore, rồi mới COPY toàn bộ code
    → layer caching: sửa code không phải tải lại NuGet

□ frontend/Dockerfile — build Vite → Nginx phục vụ file tĩnh
□ Test local: docker compose -f docker-compose.prod.yml up

🔴 docker-compose.prod.yml THIẾU 6 BIẾN — viết ngày 2026-08-05, từ đó thêm nhiều
   tính năng mà chưa cập nhật. Đã grep xác nhận không có dòng nào:
   □ Smtp__FromEmail / Smtp__Username / Smtp__Password  (Day 48)
     → thiếu: RegisterAsync rollback user vừa tạo ("Không gửi được email xác
       nhận"), ForgotPasswordAsync im lặng không gửi gì → ĐĂNG KÝ + QUÊN MẬT KHẨU
       CHẾT CẢ HAI
   □ Frontend__BaseUrl
     → thiếu: link xác nhận email và link đặt lại mật khẩu thành "/confirm-email"
       không có host → user bấm vào không đi đâu cả
   □ GoogleAuth__ClientId
     → thiếu: đăng nhập Google chết (ValidationSettings.Audience = null)
   □ Iig__*  → job iig-exam-schedule-sync chạy lỗi mỗi 6 tiếng

⚠️ CẨN THẬN khi viết file compose DEV để test local: giữ
   ASPNETCORE_ENVIRONMENT=Development trong container là mở toang /hangfire ra
   internet. Ở máy thật, thứ bảo vệ dashboard là Kestrel bind localhost — mà
   container BUỘC phải bind 0.0.0.0 mới nhận được request. Chi tiết: 08 mục 8.4
```

## Day 51 — Mua VPS + bảo mật máy

```
□ Mua VPS 4GB RAM / 2 vCPU / ≥40GB SSD, Ubuntu 22.04
  → 2GB KHÔNG đủ (riêng SQL Server cần 2GB)
  → 8GB không giúp gì thêm (Express chặn cứng ở 1.4GB buffer pool)
  → Ưu tiên VPS Việt Nam hoặc Singapore (độ trễ)

□ BẢO MẬT TRƯỚC KHI CÀI GÌ KHÁC:
  □ adduser + usermod -aG sudo (không dùng root)
  □ ssh-copy-id, rồi TẮT PasswordAuthentication trong sshd_config
  □ ufw allow 22,80,443 && ufw enable
  → VPS mới dựng bị bot dò mật khẩu SSH trong vòng vài phút

□ Cài Docker + Docker Compose
```

## Day 52 — Tên miền + DNS

```
□ Mua tên miền (Namecheap / Cloudflare Registrar / nhà cung cấp VN)
□ Bản ghi A: @ → IP VPS, www → IP VPS
□ Cân nhắc trỏ qua Cloudflare (CDN + chống DDoS + giấu IP thật VPS)
□ Kiểm tra: nslookup tenmien.com
```

## Day 53 — Nginx reverse proxy

```
□ location /      → root file tĩnh + try_files $uri $uri/ /index.html
  ⚠️ BẮT BUỘC cho SPA. Thiếu dòng này → F5 ở trang bất kỳ ra 404
□ location /api/  → proxy_pass http://api:8080
□ proxy_set_header X-Forwarded-For / X-Forwarded-Proto / X-Real-IP
□ client_max_body_size 200M (CM upload ZIP audio)
□ location /uploads/ — add_header Accept-Ranges bytes (cho phép tua audio)

□ Phía .NET: app.UseForwardedHeaders(...)
  → không có thì rate limit theo IP SAI HOÀN TOÀN (mọi request mang IP Nginx)

□ Thêm UseHsts + security headers + đổi AllowedHosts từ "*" thành domain thật
```

## Day 54 — SSL + migration production

```
□ apt install certbot python3-certbot-nginx
□ certbot --nginx -d tenmien.com -d www.tenmien.com
□ certbot renew --dry-run   (chứng chỉ hạn 90 ngày, phải tự động gia hạn)
□ Ép HTTP → HTTPS (redirect 301)

□ Migration lên DB production — cách an toàn nhất:
    dotnet ef migrations script --idempotent -o migrate.sql
  □ Đọc migrate.sql rồi mới chạy bằng sqlcmd
□ Seed role + tài khoản demo cho cả 3 role
```

## Day 55 — ⭐ Thi thật trên điện thoại, dùng 4G

```
□ THI TRỌN MỘT ĐỀ TRÊN ĐIỆN THOẠI THẬT, TẮT WIFI, DÙNG 4G

□ Bốn thứ dễ vỡ, kiểm tra từng cái:
  □ Token 2 tiếng — Day 44 đã sửa chưa? Nếu chưa sẽ thấy tận mắt vì sao nghiêm trọng
  □ Autoplay audio Part 3/4 trên iOS Safari (Safari chặn autoplay, cần thao tác chạm)
  □ Tải audio 30–50MB qua 4G — chậm giữa bài thi là hỏng cả lần thi
  □ Reading Part 7 trên màn 6 inch — passage dài + 5 câu hỏi

□ Ghi lại danh sách lỗi quan sát được → sửa ngay hoặc đưa vào ngày đệm
```

## Day 56 — Backup + health check + bộ dự phòng demo

```
□ Backup DB tự động (cron 3h sáng, BACKUP DATABASE ... WITH INIT)
□ ⚠️ Đẩy backup SANG MÁY KHÁC — backup cùng máy với DB thì không phải backup
□ DIỄN TẬP KHÔI PHỤC THẬT ÍT NHẤT MỘT LẦN
  → backup chưa từng được restore là backup chưa được chứng minh

□ Thêm /health/live và /health/ready (MapHealthChecks)
  ⚠️ NHỚ [AllowAnonymous] — fallback policy Day 34 sẽ chặn nếu quên
□ Uptime monitor miễn phí (UptimeRobot) ping mỗi 5 phút

□ 🎬 BỘ DỰ PHÒNG DEMO — demo chết đúng lúc phỏng vấn là chuyện sẽ xảy ra:
  □ Video demo 3–5 phút CÓ TIẾNG NÓI CỦA CHÍNH BẠN
  □ docker compose up chạy toàn hệ thống trên laptop KHÔNG CẦN INTERNET
  □ Bộ ảnh chụp các luồng chính trong README
  □ Tài khoản demo 3 role — KIỂM TRA LẠI MỖI TUẦN, không phải làm một lần rồi thôi
```

> ## 📮 TỪ HÔM NAY: BẮT ĐẦU RẢI HỒ SƠ — song song, không phải sau
> Chu kỳ tuyển mất **2–6 tuần**. Nộp từ lúc **có URL chạy thật** là **miễn phí về thời gian**.
> Và mỗi buổi phỏng vấn thật trả về **danh sách câu hỏi thật** — chính xác hơn mọi phỏng đoán — để
> quyết định 18 ngày còn lại làm gì.
> **Nộp vài công ty KHÔNG phải nguyện vọng chính trước** để lấy phản hồi.

---

# Phase 4 — CI/CD (Day 57–60)

## Day 57 — CI: build + test

```
□ .github/workflows/ci.yml (thư mục hiện RỖNG — 30 test đang nằm không)
  □ Job backend: setup-dotnet 8 → restore → build → test
  □ Job frontend: setup-node 22 → npm ci → npm run build
□ Bật branch protection: PR phải pass CI mới merge được
```

## Day 58 — Bảo mật tự động trong CI

```
□ gitleaks / trufflehog — chặn merge nếu có secret trong diff
□ Bật GitHub secret scanning + push protection
□ Dependabot (NuGet + npm)
□ dotnet list package --vulnerable
□ npm audit
□ Trivy quét Docker image

→ ~30 phút cấu hình, và tạo ra một câu trả lời cụ thể:
  "CI của em chặn merge nếu có secret hoặc CVE mức high"
→ Không có bước này thì đúng loại lỗi vừa vá ở Day 40 sẽ tái phát ở lần commit vội thứ hai
```

## Day 59 — CD: merge main → tự deploy

```
□ Workflow deploy: build image → push → ssh vào VPS → docker compose pull && up -d
□ Zero-downtime ở tầng container
□ Rollback: giữ image cũ, có lệnh quay lại nhanh
```

## Day 60 — Migration trên dữ liệu SỐNG

```
□ ⚠️ Sau khi có user thật, mọi đổi schema đều đụng dữ liệu đang sống:
  □ Băm refresh token (Day 48) — vô hiệu token đang lưu hành hay backfill?
  □ Thêm RowVersion cho TestSession (Day 65)
  □ Unique filtered index trên phiên InProgress
    → MIGRATION SẼ THẤT BẠI nếu dữ liệu hiện có đã có phiên trùng
      do đúng cái bug F5 (Day 45). Phải dọn dữ liệu trước.

□ Viết checklist: backfill · tương thích ngược · cửa sổ bảo trì
□ Trả lời được: chuyện gì xảy ra với phiên thi đang InProgress lúc deploy?

→ Đây CHÍNH XÁC là chỗ interviewer đào khi nghe "em có CI/CD tự động deploy"
```

---

# Phase 5 — Tầng Application + Test (Day 61–67)

> ## 🔴 Vì sao phase này quan trọng nhất về mặt phỏng vấn
> `ToeicMasterPro.Application` **chỉ chứa `Common/Interfaces` và `DTOs`**. Toàn bộ service nghiệp vụ
> nằm trong `Infrastructure/Services`.
>
> → Câu chuyện **"Clean Architecture 4 tầng"** bạn định kể **gần như rỗng ruột**.
> **"Tầng Application của em chứa gì?"** là câu giết nhanh nhất repo đang phơi ra.
>
> → Hệ quả kỹ thuật: logic chấm điểm sống chung với `DbContext` nên mọi "unit test cho
> `TestSessionService`" thực chất là **integration test phải dựng DB**.

## Day 61–62 — Characterization test (lưới an toàn)

```
□ Testcontainers cho SQL Server (hoặc SQLite in-memory nếu vướng WSL2)
□ Test integration cho luồng: Start → SaveAnswers → Submit → GetDetail
□ Ghi lại hành vi HIỆN TẠI — kể cả hành vi sai
  → đây là lưới an toàn để Day 63–64 đập code mà không sợ

□ Bao phủ: full test · partial test (PartsFilter) · câu bỏ qua · đề không có đáp án đúng
```

## Day 63–64 — Tách logic thuần lên tầng Application

```
□ Chuyển lên Application (không phụ thuộc EF Core):
  □ Logic chấm điểm
  □ Quy đổi ETS (ToeicScoreHelper đã ở đúng chỗ)
  □ PartBreakdown
  □ Kiểm tra trạng thái phiên hợp lệ

□ Infrastructure chỉ còn: lấy dữ liệu ra → gọi Application → ghi kết quả xuống
□ Tầng Application từ "chỉ có interface + DTO" thành CÓ NGHIỆP VỤ THẬT
□ Test Day 61–62 phải vẫn xanh sau khi tách
```

## Day 65 — Unit test nhanh + vá lỗi đúng đắn dữ liệu

```
□ Test cũ giờ chạy được thành unit test KHÔNG CẦN DB (nhanh gấp hàng chục lần)

□ Vá các lỗi đúng đắn dữ liệu, mỗi lỗi kèm một test:
  □ GetDetail chấm lại theo scope đề HIỆN TẠI → điểm xem lại khác lịch sử
    (ví dụ đã kiểm chứng: Reading 76/100 = 335; CM thêm 1 câu → scope 101
     → rơi khỏi bảng ETS sang công thức MVP → 375, LỆCH 40 ĐIỂM)
    → Sửa: dùng snapshot điểm đã lưu lúc Submit, đừng chấm lại
  □ SkippedCount ở nhánh fallback tính sai (đang là "số câu SAI + BỎ QUA")
  □ fullOnly nhận diện full test bằng PartsFilter rỗng
    → user chọn ĐỦ 7 Part vẫn bị loại khỏi thống kê
  □ WeakestParts không tính cỡ mẫu → làm 1 câu Part 2 sai = Part 2 mãi "yếu nhất"
  □ Điểm nhảy bậc khi section lệch 1 câu so với 100 (ToeicScoreHelper.cs:41-52)

□ Thêm RowVersion (concurrency token) cho TestSession
  → chống TOCTOU: 2 request submit đồng thời cùng qua check InProgress → 500
```

## Day 66 — Tách TestSessionService 935 dòng

```
□ Tách theo bản đồ của CHÍNH BẠN, không theo gợi ý có sẵn
  → gợi ý: SessionLifecycle / Grading / History+Stats
□ Xóa code chết: IApplicationDbContext (không đăng ký DI), ListAllAsync,
  trạng thái Abandoned
□ Cột TestSessionAnswer.IsCorrect đang GHI mà KHÔNG BAO GIỜ ĐỌC
  → hoặc dùng nó ở Day 70, hoặc bỏ hẳn
```

## Day 67 — 🎯 Kiểm chứng độc lập

```
□ Chọn MỘT trong ba:
  □ Nhờ một senior review repo
  □ Mở PR công khai cho người lạ đọc
  □ Đăng một quyết định kiến trúc lên cộng đồng lấy phản biện

→ Với người tự học một mình và có tiền sử copy-paste code AI,
  TỰ ĐÁNH GIÁ LÀ ĐIỂM MÙ CÓ HỆ THỐNG
```

> ### 💡 Chèn vào bất kỳ đâu từ Day 61: đóng góp 1–2 PR nhỏ vào repo .NET open-source
> Ba câu interviewer hỏi gần như mọi junior: *"nhóm bạn dùng git flow gì, xử lý conflict thế nào"* ·
> *"bạn review code người khác ra sao và phản ứng thế nào khi bị review"* · *"kể một lần bất đồng với
> đồng nghiệp về kỹ thuật"*. Sau 42 ngày một mình bạn **vẫn không có gì để trả lời**.
>
> Sửa docs, thêm test, vá một issue `good-first-issue` — tốn 2–3 ngày, tạo ra câu chuyện cộng tác
> **thật**, một lần **bị maintainer review**, và một link công khai trên CV. Thứ mà 42 ngày sửa lỗi
> trong repo của chính mình **không bao giờ sinh ra được**.

---

# Phase 6 — EF Core + Redis (Day 68–71)

> EF Core và SQL Server chiếm khoảng **một phần ba** thời lượng kỹ thuật trong phỏng vấn .NET junior
> ở VN — và đây chính là chỗ dự án đang yếu nhất.

## Day 68 — Đo trước đã

```
□ Bật EF Core logging, xem SQL THẬT sinh ra cho từng endpoint
□ Đọc execution plan trong SSMS — tìm chữ "Table Scan" / "Index Scan"
□ Ghi số baseline: thời gian phản hồi, số query, số dòng nạp về
  → /dashboard · /test-session/stats/parts · /test-session/history · /test/{id}/play

⚠️ KHÔNG TỐI ƯU KHI CHƯA ĐO. Tối ưu theo cảm tính là đoán mò.
```

## Day 69 — Sửa gốc rễ: Repository

```
□ Repository.FindAsync trả IReadOnlyList<T> (ĐÃ materialize)
  → mất IQueryable, mất Include, phân trang chạy trong RAM, không có projection
  → ĐÂY LÀ NGUỒN GỐC gần như mọi vấn đề hiệu năng

□ Chọn một hướng và giải thích được vì sao:
  □ Cho IRepository<T> trả IQueryable<T>, hoặc
  □ Thêm overload FindAsync(predicate, orderBy, skip, take, selector), hoặc
  □ Bỏ Repository cho query phức tạp, inject DbContext trực tiếp
    (SrsService.cs:19 đã làm đúng điều này rồi)

□ AsNoTracking mặc định:
    options.UseSqlServer(...).UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
  → hiện grep toàn solution: 0 kết quả cho AsNoTracking

□ Truyền CancellationToken xuyên suốt (chi phí gần bằng 0)
  → hiện IRepository CÓ tham số ct nhưng KHÔNG action nào nhận, KHÔNG chỗ nào truyền
  → user F5 liên tục thì query cũ vẫn chạy tới cùng, chiếm connection pool
```

## Day 70 — Tối ưu query, ghi số trước/sau

```
□ /stats/parts: hiện nạp TOÀN BỘ answer + question + option của user, KHÔNG CÓ TRẦN
  □ Một query LINQ join Answer→Question, GroupBy(q.Part), Select ra count
  □ Dùng ans.IsCorrect ĐÃ LƯU SẴN thay vì query lại QuestionOption
  □ Giới hạn 20 phiên gần nhất (vừa nhanh vừa đúng nghiệp vụ hơn)

□ Phân trang lịch sử thi xuống SQL (hiện Skip/Take chạy ở C#)
□ TestService: đếm số câu bằng CountAsync, không nạp cả bảng TestQuestions
□ PracticeService: random dưới SQL, không nạp cả kho câu hỏi
□ VocabularyService: bỏ .ToLower() (vô hiệu hóa index) → dùng collation CI ở cột
□ ExamScheduleService: bỏ hàm trên cột ExamDate → dùng khoảng ngày

□ Index: thêm TestQuestions(TestId, OrderIndex) — truy vấn nóng nhất chưa có
  ⚠️ KHÔNG thêm index cho RefreshTokens.Token / TestSessions(UserId,Status) /
     TestSessionAnswers.SessionId — CẢ BA ĐÃ TỒN TẠI (dự án có 29 index, THỪA chứ không thiếu)

□ Ghi bảng benchmark TRƯỚC/SAU vào README
```

## Day 71 — Redis phải tự kiếm chỗ đứng

```
□ Hiện Redis là MÃ CHẾT: ICacheService không service nào inject
  (grep toàn solution chỉ ra 2 chỗ: dòng đăng ký DI và chính class implement)
  Nhưng vẫn đủ sức làm sập app lúc boot.

□ Chọn MỘT và giải thích được vì sao:
  □ Dùng thật: cache dashboard stats (TTL 5 phút hoặc xóa lúc submit)
    + cache cấu trúc đề (TTL 1 giờ), có chiến lược invalidation rõ ràng
  □ Hoặc GỠ KHỎI DỰ ÁN một cách đàng hoàng

→ Cả hai đều là quyết định kể được. Giữ nguyên hiện trạng thì không.
```

---

# Phase 7 — AI + Đóng gói (Day 72–74)

## Day 72 — AI giải thích đáp án (có kiểm soát)

```
□ Tích hợp Claude API qua IHttpClientFactory
□ Polly: retry + circuit breaker + timeout
□ Cache Redis 7 ngày theo questionId  ← đây là lúc Redis THẬT SỰ có việc
□ Rate limit theo user (không thì một người spam là cháy ví)
□ Fallback khi API lỗi: hiện giải thích tĩnh có sẵn, không để trang trắng

→ CV ghi được "tích hợp LLM", nhưng thứ THẬT SỰ học được là resilience
  và kiểm soát chi phí — cái interviewer .NET đào được
```

## Day 73 — README + đóng gói

```
□ README: kiến trúc (sơ đồ), ảnh chụp các luồng chính, tài khoản demo
□ Ghi rõ QUYẾT ĐỊNH THIẾT KẾ VÀ ĐÁNH ĐỔI — không chỉ liệt kê công nghệ
□ Bảng benchmark trước/sau (Day 70)
□ Ghi chú bản quyền nội dung (Day 33)
□ Sửa docs/06-database.md — thiếu hẳn bảng RefreshTokens, sai nullability Vocabulary
□ Code splitting frontend: React.lazy cho trang CM (bundle hiện 1.5MB)

→ Nhà tuyển dụng chạm vào README và commit log TRƯỚC TIÊN
```

## Day 74 — Phỏng vấn thử có áp lực

```
□ Tự trả lời 41 câu trong 08-cam-nang-cong-nghe.md
□ NÓI TO, BẤM GIỜ, GHI ÂM LẠI
□ Nghe lại bản ghi — chỗ nào lắp là chỗ chưa hiểu
□ Quay lại đọc phần tương ứng, rồi NÓI LẠI (đọc lại không giải quyết được)

□ Diễn tập demo 15 phút: mở link → đăng nhập → thi 1 Part → xem kết quả → nói về kiến trúc
```

---

## 🛟 Quy tắc khi trượt lịch

Vài việc **gần như chắc chắn tràn**: deploy lần đầu (Day 50–54), refactor Repository (Day 69),
Testcontainers trên Windows/WSL2 (Day 61).

1. **Nghỉ 1 ngày/tuần**, không tính vào lịch. 42 ngày liên tục không nghỉ là công thức chuẩn để dự án
   solo chết ở tuần thứ năm.
2. **Nếu 1 ngày biến thành 3 ngày → cắt từ Phase 6 (Day 68–71) và Day 72.**
   **TUYỆT ĐỐI KHÔNG cắt Day 73–74** — đó là phần giá trị phỏng vấn cao nhất, và trượt lịch luôn tự
   động ăn vào phần cuối nếu không có quy tắc này.
3. **Ngày đệm có sẵn:** Day 49.
4. **Cuối mỗi tuần 30′:** tuần này lệch bao nhiêu, vì sao, tuần sau điều chỉnh gì.

## 📣 Viết công khai — 5–6 bài trong 42 ngày

42 ngày gia cố hệ thống tạo ra **rất ít thứ người khác nhìn thấy**. Viết bài ngắn (LinkedIn / dev.to)
về đúng cái vừa sửa:

- *"Tôi tìm thấy lỗ hổng lộ toàn bộ đáp án trong dự án của chính mình"* (sau Day 34)
- *"Vì sao access token 60 phút giết một bài thi 120 phút"* (sau Day 44)
- *"Deploy .NET 8 lên VPS 4GB: những gì tài liệu không nói"* (sau Day 54)
- *"Số liệu trước/sau khi bỏ generic repository trả IReadOnlyList"* (sau Day 70)

**Lợi kép:** viết cho người ngoài đọc là **bài kiểm tra hiểu khắc nghiệt hơn** viết tài liệu cho chính
mình — không giấu được chỗ mơ hồ sau thuật ngữ. Và một bài có người đọc, có bình luận, trong quãng
14 ngày chỉ sửa lỗi là **liều thuốc động lực** mạnh hơn nhiều so với nhật ký tự viết cho mình.

---

## ✅ Đã xong — Day 1–32

| Day | Nội dung |
|---|---|
| 1–12 | Solution 4 tầng, DB + EF Core, Auth JWT + Refresh + Google OAuth, Profile, Redis (dựng dây), Serilog, FE bootstrap |
| 13–18 | CRUD Question/Test, import Excel, panel CM đề + câu hỏi |
| 19–21 | API + UI lịch thi, nhắc email qua Hangfire, iCal |
| 22–24 | API Vocabulary, SRS (SM-2) + flashcard UI |
| 25 | Practice API luyện nhanh (phụ) |
| **26–30** | **Exam Engine** — chọn đề → Directions → Listening Part 1–4 → nghỉ → Reading Part 5–7 (timer 75′, tự nộp) → chấm điểm quy đổi **ETS** + partBreakdown → review + chứng chỉ |
| 31 | Lịch sử thi, tiến độ (best score/đề), xem lại kết quả |
| 32 | Dashboard: cards tổng quan, timeline điểm (Recharts), Part yếu gom nhiều phiên |

**Nợ để lại từ giai đoạn này:** 123 vấn đề tìm ra trong đợt audit 2026-07-26 — đã phân bổ hết vào
Day 34–71 ở trên. Chi tiết từng lỗi: [09-hien-trang-va-khuyen-nghi.md](09-hien-trang-va-khuyen-nghi.md).
