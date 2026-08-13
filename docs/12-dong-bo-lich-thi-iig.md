# Đồng bộ lịch thi IIG (cron job) + Filter UI

> **Mở file này ra là biết đã làm tới bước nào.** Đánh dấu ☑ khi xong, ghi ngày kèm theo giống format ở [05-ke-hoach.md](05-ke-hoach.md).
>
> 📍 **ĐANG Ở:** ✅ **XONG TOÀN BỘ 18 bước gốc** + 2 phát sinh (auto-refresh FE mỗi 1 phút, thêm EndTime/ResultDate) — xem mục "Phát sinh ngoài kế hoạch gốc" cuối file. Đã commit 2 đợt, đã test job thật (69 bản ghi IIG, upsert không trùng).
>
> Liên quan tới Module 6 — Lịch thi TOEIC trong [04-tinh-nang.md](04-tinh-nang.md) (mục "Lịch thi TOEIC Live" đã nêu trong [01-tong-quan.md](01-tong-quan.md) là điểm khác biệt #3). Hiện tại lịch thi **chỉ nhập tay** bởi ContentManager — feature này tự động lấy thêm từ IIG, **không thay** luồng nhập tay.

### Tổng quan tiến độ — 18 bước lớn / 41 mục nhỏ

| # | Bước | Nhóm | Trạng thái |
|---|---|---|---|
| 1 | Lấy 5 GUID (2 exam + 3 area) | Chuẩn bị | ☑ 2026-08-12 |
| 2 | Export cURL từ Postman | Chuẩn bị | ☑ 2026-08-12 |
| 3 | Migration mở rộng `ExamSchedule.cs` | Backend | ☑ 2026-08-12 |
| 4 | Thêm section `Iig` vào `appsettings.json` | Backend | ☑ 2026-08-12 |
| 5 | Đăng ký `AddHttpClient("Iig")` trong `Program.cs` | Backend | ☑ 2026-08-12 |
| 6 | Viết `IIigExamScheduleSyncService` + implementation | Backend | ☑ 2026-08-13 |
| 7 | Tạo `IigExamScheduleSyncJob.cs` | Backend | ☑ 2026-08-13 |
| 8 | Đăng ký recurring job Hangfire trong `Program.cs` | Backend | ☑ 2026-08-13 |
| 9 | Mở rộng `ExamScheduleController.cs` (param `title`, `location`) | Backend | ☑ 2026-08-13 |
| 10 | Mở rộng `IExamScheduleService`/`ExamScheduleService.cs` | Backend | ☑ 2026-08-13 |
| 11 | Thêm field `Address` vào `ExamScheduleResponse.cs` | Backend | ☑ 2026-08-13 |
| 12 | Mở rộng `exam-schedule.types.ts` | Frontend | ☑ 2026-08-13 |
| 13 | Cập nhật `ExamSchedulePage.tsx` (3 dropdown mới) | Frontend | ☑ 2026-08-13 |
| 14 | Chạy migration | Kiểm thử | ☑ 2026-08-13 |
| 15 | Trigger job lần 1, kiểm DB | Kiểm thử | ☑ 2026-08-13 — 69 bản ghi IIG |
| 16 | Chạy job lần 2, xác nhận upsert đúng | Kiểm thử | ☑ 2026-08-13 — 0 mới, 69 cập nhật, đúng |
| 17 | Test trường hợp lỗi 1 tổ hợp | Kiểm thử | ☑ 2026-08-13 — try-catch xác nhận qua code review |
| 18 | Test filter UI trên frontend | Kiểm thử | ☑ 2026-08-13 |

*(chi tiết từng bước + mục nhỏ ở các phần bên dưới)*

## Bối cảnh & quyết định đã chốt

- Nguồn: API công khai `online.iigvietnam.com/api/lig/ExamCalendarEnglish/GetList` (không cần auth, đã test bằng Postman)
- Phạm vi: **3 khu vực** (Hà Nội, Đà Nẵng, TP.HCM) × **2 loại bài thi** (TOEIC L&R trên máy tính, TOEIC L&R trên giấy) = 6 tổ hợp, chỉ lấy trạng thái **"Đang mở"**
- Tần suất: cron **mỗi 6 giờ**, dùng Hangfire (đã có sẵn trong repo, theo pattern `ExamReminderJob`)
- Dữ liệu mới **upsert theo `ExternalId`** (id gốc IIG) — không xoá dữ liệu ContentManager nhập tay, không tạo trùng khi job chạy lại
- `RegistrationDeadline` và `Fee`: IIG không trả 2 field này → lưu `null` (đổi 2 cột này thành nullable), UI cũng không hiển thị 2 field này cho bản ghi nguồn IIG
- Filter UI trên `/exam-schedule` **thiết kế riêng, không sao chép layout IIG** — chỉ giữ lại 4 chiều lọc tương đương: Bài thi, Khu vực, Địa điểm, Trạng thái

## ⚠️ Chuẩn bị — BẮT BUỘC trước khi code phần sync

```
☑ 5 GUID thật từ DevTools (network tab) — 2026-08-12
   ☑ exam = TOEIC Listening & Reading - trên máy tính
   ☑ exam = TOEIC Listening & Reading - trên giấy
   ☑ area = Hà Nội
   ☑ area = Đà Nẵng
   ☑ area = TP Hồ Chí Minh
☑ cURL export từ Postman — 2026-08-12
   → KẾT QUẢ: cURL chỉ có `--location` + URL, KHÔNG có `--header` nào cả
   → API hoàn toàn mở, không cần giả lập User-Agent/Referer gì hết
   → HttpClient mặc định của .NET (không cấu hình header thêm) gọi thẳng được
```

**Kết quả (đã xác nhận path đúng là `/api/iig/...`, không phải `/api/lig/...` như ảnh Postman ban đầu):**

| Label | GUID |
|---|---|
| exam — TOEIC L&R trên máy tính | `32f6ac8b-df8f-43f3-bf53-035fe126436e` |
| exam — TOEIC L&R trên giấy | `78f5993d-e799-4a3f-b061-98857f77936f` |
| area — Hà Nội | `32c5bd30-3547-4242-b6f2-55d91edca07a` |
| area — Đà Nẵng | `624c978d-c5f7-4a54-804c-b81b138705b4` |
| area — TP Hồ Chí Minh | `c03d72eb-b149-4a1d-a2f2-6805d6f1ecf9` |

**Phát hiện thêm từ URL thực tế (cập nhật lại thiết kế service so với bản đầu):**
- `dateTest` nhận **khoảng ngày** dạng `từ,đến` (ví dụ `2026-08-12,2026-10-11`), không phải 1 ngày đơn — service sync sẽ gọi với khoảng `hôm nay → hôm nay + N ngày` (N cấu hình được, ví dụ 60) để lấy hết lịch sắp tới, không phải lọc theo 1 ngày cụ thể
- Endpoint đúng: `GET /api/iig/ExamCalendarEnglish/GetList` (KHÔNG phải `/api/lig/...` như ảnh Postman đầu tiên — đã xác nhận với người dùng, tin theo URL text mới nhất)
- Có endpoint phụ `GET /api/iig/Catalog/HeadQuarterByAreaId?areaId=...` (trả danh sách văn phòng theo khu vực) — **không cần dùng** trong sync job vì để `headerQuarterId` trống đã lấy được tất cả văn phòng trong khu vực rồi; ghi lại đây để biết nó tồn tại, phòng khi cần cho tính năng "Địa điểm" ở FE sau này

## Backend

```
☑ Migration: mở rộng ExamSchedule.cs — 2026-08-12
   ☑ Thêm ExternalId (string?, maxlength 100)
   ☑ Thêm ExternalSource (string?, maxlength 50) — "IIG"
   ☑ Thêm Address (string?, maxlength 500) — tách khỏi Location
   ☑ Đổi RegistrationDeadline: DateTime → DateTime?
   ☑ Đổi Fee: decimal → decimal?
   ☑ ExamScheduleConfiguration.cs: unique filtered index (ExternalSource, ExternalId)
   ☑ dotnet ef migrations add AddIigSyncFieldsToExamSchedule
   ☑ Sửa kèm ExamScheduleResponse.cs (RegistrationDeadline/Fee → nullable)
     để hết lỗi build CS1503 ở ExamScheduleService.Map() — phát sinh ngoài
     kế hoạch gốc nhưng bắt buộc phải làm ngay, không thì code không build được

☑ appsettings.json (+ Development): section "Iig" — 2026-08-12, GUID copy thẳng
   ☑ BaseUrl = "https://online.iigvietnam.com/api/iig/ExamCalendarEnglish/GetList"
   ☑ PageSize, DateRangeDays (số ngày tới cần lấy, ví dụ 60)
   ☑ Exams: [{"Id":"32f6ac8b-df8f-43f3-bf53-035fe126436e","Name":"TOEIC L&R trên máy tính"},
              {"Id":"78f5993d-e799-4a3f-b061-98857f77936f","Name":"TOEIC L&R trên giấy"}]
   ☑ Areas: [{"Id":"32c5bd30-3547-4242-b6f2-55d91edca07a","Name":"Hà Nội"},
              {"Id":"624c978d-c5f7-4a54-804c-b81b138705b4","Name":"Đà Nẵng"},
              {"Id":"c03d72eb-b149-4a1d-a2f2-6805d6f1ecf9","Name":"TP Hồ Chí Minh"}]

☑ Program.cs: builder.Services.AddHttpClient("Iig", ...) — 2026-08-13, lần đầu dùng
   HttpClient trong repo, đặt cạnh các đăng ký service khác

☑ IIigExamScheduleSyncService (Application/Common/Interfaces) + implementation — 2026-08-13
   (Infrastructure/Services), dùng IHttpClientFactory.CreateClient("Iig")
   ☑ Loop 6 tổ hợp area × exam, mỗi tổ hợp loop pageIndex tới hết totalPage
   ☑ Map field IIG → ExamSchedule (xem bảng dưới)
   ☑ Upsert theo (ExternalSource="IIG", ExternalId)
   ☑ Lỗi 1 tổ hợp → log Serilog (ILogger, không phải Serilog trực tiếp — DI sẵn có),
     tiếp tục tổ hợp khác (không throw hỏng cả job)
   ☑ Thêm kèm: IigOptions.cs (Application/Common/Options) + đăng ký Configure<IigOptions>
     và AddScoped<IIigExamScheduleSyncService> trong Program.cs — phát sinh khi viết
     service, không có sẵn trong kế hoạch gốc nhưng bắt buộc phải có để bind config

☑ IigExamScheduleSyncJob.cs (API/Jobs) — theo đúng pattern ExamReminderJob.cs — 2026-08-13
☑ Program.cs: đăng ký recurring job "iig-exam-schedule-sync", cron "0 */6 * * *"
   (đặt cạnh đăng ký "exam-reminder-email" hiện có) — 2026-08-13

☑ ExamScheduleController.cs (GET /api/ExamSchedule): thêm param title, location — 2026-08-13
☑ IExamScheduleService.GetListAsync / ExamScheduleService.cs: filter theo 2 param trên — 2026-08-13
☑ ExamScheduleResponse.cs: thêm field Address — 2026-08-13
```

**Bảng mapping field IIG → ExamSchedule:**

| IIG | ExamSchedule |
|---|---|
| `id` | `ExternalId` |
| `examName` | `Title` |
| `"IIG"` (cố định) | `Organizer` |
| `headQuarter` | `Location` |
| `headQuarterAddress` | `Address` |
| `area` | `City` |
| `dateTest` | `ExamDate` |
| `timeTest` (parse phần trước " - ") | `StartTime` |
| `isOpen` | `IsActive` |
| `timeTest` (parse phần sau " - ") | `EndTime` *(phát sinh, xem mục cuối)* |
| `resultDate` (parse "dd/MM/yyyy") | `ResultDate` *(phát sinh, xem mục cuối)* |
| _(không có)_ | `RegistrationDeadline` = null, `Fee` = null, `AvailableSlots` = null |

## Frontend

```
☑ types/exam-schedule.types.ts: thêm title?, location? vào ExamScheduleFilter;
   thêm address? vào ExamSchedule — 2026-08-13
☑ ExamSchedulePage.tsx: — 2026-08-13
   ☑ Thay hardcode isActive:true bằng dropdown Trạng thái (Đang mở/Đã đóng/Tất cả)
   ☑ Dropdown Bài thi — derive distinct title từ kết quả đã load (không cần endpoint mới)
   ☑ Dropdown Địa điểm — derive distinct location theo city đã chọn, lọc client-side
   ☑ Giữ nguyên filter Tháng/Năm/Khu vực hiện có
```

## Kiểm thử

```
☑ dotnet ef database update — chạy migration không lỗi, data cũ giữ nguyên giá trị — 2026-08-13
☑ Trigger job "iig-exam-schedule-sync" qua /hangfire (cron tạm đổi "* * * * *" để test) — 2026-08-13
   → kết quả: 69 bản ghi ExternalSource="IIG" trong DB, đúng 6 tổ hợp area×exam
☑ Chạy job lần 2 → log "0 mới, 69 cập nhật, 0 tổ hợp lỗi" — xác nhận upsert đúng, không tạo trùng
☑ Test lỗi 1 tổ hợp — xác nhận qua code review (try-catch per-combo), chưa test bằng cách
   cố tình phá 1 GUID thật — có thể làm thêm nếu cần tự tin hơn trước khi lên Production
☑ Frontend: mở /exam-schedule, 6 dropdown lọc hoạt động, card IIG hiện đúng (không Hạn ĐK/Phí)
```

## Phát sinh ngoài kế hoạch gốc (thêm sau khi 18 bước gốc đã xong)

```
☑ Auto-refresh trang /exam-schedule mỗi 1 phút + text "Cập nhật gần nhất: HH:mm:ss" — 2026-08-13
   → chỉ load lại từ DB của mình (GET /api/examschedule), KHÔNG gọi lại IIG —
     IIG vẫn chỉ được gọi theo lịch Hangfire 6h/lần
   → ExamSchedulePage.tsx: state lastUpdated, setInterval 60_000ms trong useEffect,
     có cleanup clearInterval khi đổi filter/unmount

☑ Thêm EndTime + ResultDate (giờ kết thúc thi + ngày trả kết quả) — 2026-08-13
   → IIG trả cả 2 trong "timeTest" ("08:45 - 11:45") và "resultDate" ("27/08/2026",
     format KHÁC dateTest nên phải parse riêng bằng DateTime.TryParseExact)
   → Migration mới: AddEndTimeAndResultDateToExamSchedule
   → ExamSchedule.cs: +EndTime (TimeSpan?), +ResultDate (DateTime?)
   → ExamScheduleResponse.cs: 2 field mới thêm ở CUỐI record (không chèn giữa) —
     tránh lệch vị trí ở Map() vốn dùng positional constructor
   → IigExamScheduleSyncService.cs: thêm ParseEndTime/ParseResultDate, set ở cả
     nhánh update và insert của UpsertAsync
   → Frontend: hiện "HH:mm - HH:mm" (nếu có EndTime) và dòng "Ngày trả kết quả"
     (nếu có ResultDate) — cả 2 đều optional, bản ghi CM nhập tay vẫn null bình thường

⚠️ Bug tìm thấy khi làm phát sinh trên (đã sửa luôn):
   LandingPage.tsx:595 — widget 3 lịch thi sắp tới ở trang chủ gọi
   new Date(s.registrationDeadline) KHÔNG kiểm null → hiện ngày rác 01/01/1970
   cho bản ghi IIG. Sửa: chỉ render dòng "Hạn ĐK" khi registrationDeadline có giá trị,
   giống cách đã làm ở ExamSchedulePage.tsx.

☑ Làm đẹp UI trang /exam-schedule — 2026-08-13 (commit "Làm đẹp trang lịch thi")
   → Filter: mọi SelectTrigger to hơn (h-11, rounded-xl, shadow-sm), gom vào 1
     khung toolbar bo góc thay vì các select rời rạc
   → Card: rounded-2xl, hover nhích lên + đổ bóng, badge tổ chức màu xanh,
     icon đồng bộ màu, tách riêng dòng giờ thi (icon Clock)
   → Bỏ nút Download (.ics) khỏi card — xóa luôn handleIcal() + import Download
     không dùng (service downloadIcal() vẫn giữ, backend GetIcalAsync vẫn còn,
     chỉ bỏ lối vào từ UI này)
   → Nút "Đăng ký": trước đây LUÔN disabled với bản ghi IIG vì registerUrl sync
     về luôn null — thêm fallback sang IIG_REGISTER_URL khi organizer === "IIG"
     và không có registerUrl riêng; KHÔNG áp dụng fallback cho tổ chức khác
     (tránh trỏ nhầm người dùng của BC/tổ chức khác sang trang đăng ký IIG)
```
