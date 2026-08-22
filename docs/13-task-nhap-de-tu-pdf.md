# Task: Nhập đề ETS từ PDF + audio bằng AI

**Trạng thái:** đang làm — tool đã có `probe`, `names`, `render`
**Ngày lập:** 22/08/2026 · **Cập nhật:** 23/08/2026

---

## 📍 TOOL NẰM NGOÀI REPO — `D:\ets-importer\`

Console app .NET 8, **độc lập hoàn toàn** với repo này (không `ProjectReference`, không đường
dẫn tương đối trỏ ra ngoài). Copy cả thư mục sang máy khác là chạy được.

```bash
cd D:\ets-importer
dotnet run -- probe  "D:\Test2026"
dotnet run -- names  "Test2026" "Test1"
dotnet run -- render "D:\Test2026\LISTENING ETS 2026.pdf" 142 144
```

**Vì sao để ngoài repo** — và vì sao lúc đầu tôi làm ngược lại: ban đầu tool tham chiếu
`ToeicMasterPro.Application` để dùng chung `ToeicMediaNaming`, mục đích là tên file tool sinh
ra và tên server mong đợi **không thể lệch nhau**. Nhưng theo thiết kế đã chốt, **tool ghi
thẳng tên file thật vào cột `AudioFile`/`ImageFile` của Excel**, mà server chỉ tự sinh tên khi
hai cột đó **để trống** (`QuestionService`: `if (string.IsNullOrWhiteSpace(audioFile) && …)`).
Server không bao giờ sinh tên cho file do tool tạo → **không còn gì phải dùng chung**. Lý do
duy nhất giữ nó trong repo tự biến mất, nên tách ra: tool là **tiện ích sản xuất nội dung**,
không phải code sản phẩm — không nên vào build/test/CI của app.

`ToeicNaming.cs` trong thư mục tool là **bản sao** của `ToeicMediaNaming`, chỉ còn phục vụ
việc riêng của tool (kiểm kê đủ/thiếu audio, so tên có leading zero). Lệnh `names` dự đoán
hành vi server bằng bản sao đó → **chỉ là tiện ích tham khảo**, không phải nguồn sự thật.

---

## ✅ Đã kiểm chứng trên bộ đề thật (`D:\Test2026`)

| Hạng mục | Kết quả |
|---|---|
| **Audio** | ✅ **540/540 file, 10 đề × 54 file, không thiếu câu nào.** Tên khớp chính xác quy ước, kể cả nhóm 3 câu Part 3–4 (`E26-T01-32-34.mp3`). **Không phải đổi tên gì** |
| **4 PDF** | 🔴 **SCAN 100%** — 0 ký tự text trên mọi trang. Không có đường parse text |
| Ảnh nhúng | 🔴 Mỗi trang có 4 ảnh ~2433×1095 — là **4 dải scan ngang**, KHÔNG phải ảnh câu hỏi. `GetImages()` vô dụng, phải **render cả trang** bằng PDFium |
| Chất lượng render | ✅ **150 DPI là đủ** — đã tự đọc ảnh render, bảng đáp án `N (X)` rõ từng ký tự. Không cần 300 DPI |
| Tốc độ render | 3 trang / 1,6s → cả **744 trang ~7 phút** |
| **Đáp án** | ✅ **Đã định vị hết** — xem bảng dưới |
| `key rc .pdf` | ✅ **GIỮ LẠI** — đã xác nhận là nguồn thứ hai THẬT cho RC, không phải bản trùng vô ích |

### Bản đồ trang đáp án — chỉ 9 trang cho cả 2000 câu

| Nguồn | Trang | Câu | Chia đề |
|---|---|---|---|
| `LISTENING ETS 2026.pdf` | **142, 143, 144** | 1–100 (LC) | 4 + 4 + 2 đề/trang |
| `READING ETS 2026.pdf` | **302, 303, 304** | 101–200 (RC) | 4 + 4 + 2 đề/trang |
| `key rc .pdf` | **2, 3, 4** (trang 1 là bìa) | 101–200 (RC) | 4 + 4 + 2 đề/trang |

Cả ba cùng một định dạng: bảng `N (X)`, **20 hàng × 5 cột**, tiêu đề `기출 TEST n`.

**RC có HAI nguồn độc lập** (`READING` trang cuối + `key rc`) → lệnh `answers` đọc cả hai rồi
**đối chiếu từng câu**. Lệch một câu là biết ngay đã đọc nhầm, tự động, không cần soát tay.
LC chỉ có một nguồn → phải dựa vào kiểm đếm (đúng 100 câu, số 1→100 liên tục, giá trị chỉ A–D).

Đây là điểm quan trọng nhất của cả task: **phần "sai là chết người" lại là phần rẻ nhất** —
9 trang trên tổng 744, và định dạng đều tới mức máy gần như không thể đọc sai.

## 🔴 Bẫy đã va, ghi lại để không lặp

**File rác macOS.** Lần đầu giải nén, `audio.zip` chỉ chứa **540 file `._E26-*.mp3` nặng đúng
187 byte** (AppleDouble) — **không một file audio thật nào**, mà tổng vẫn "540 file" nên nhìn
qua tưởng đủ. Tool lọc `._*`, `__MACOSX/`, `.DS_Store` và **báo số đã lọc** chứ không im lặng.

**`ToExamCode` không rút gọn năm như tưởng.** `ToExamCode("ETS 2026")` trả `ETS2026`, KHÔNG
phải `E26` — vì bỏ dấu cách xong thì chuỗi khớp ngay nhánh regex đầu. Mà `"ETS 2026"` đúng là
ví dụ ghi trong comment của `Test.Series`. Không còn ảnh hưởng sau khi tool điền `AudioFile`
tường minh, nhưng **vẫn là bẫy nếu ai sửa câu bằng tay và để trống cột đó**.

**`ToTestCode` lấy SỐ ĐẦU TIÊN.** `"ETS 2026 - TEST 1"` → `T2026`. Placeholder ở
`TestFormPage` là `"TEST 1 – ETS 2026"` nên vô tình đúng; đảo thứ tự là vỡ.

---

## 1. Vấn đề

Một bộ ETS gồm:

- **2 file PDF** — một Reading, một Listening, mỗi file chứa **cả 10 đề**, đáp án ở cuối file
- **Thư mục audio** — dạng chưa xác định (xem mục 5)

Nhập tay vào Excel theo template hiện tại là **2000 câu cho mỗi bộ ETS**
(10 đề × 200 câu). Không khả thi.

Mục tiêu: từ PDF + audio ra được **file ZIP đúng định dạng import** (Excel + audio +
images), tự động hoặc gần tự động.

---

## 2. Điểm quan trọng: có thể bạn đang gõ thừa

Kiểm tra `QuestionService.cs:325-329` — hệ thống **tự sinh tên file audio/ảnh** từ
`Series` + `Title` + `OrderIndex`, kể cả xử lý nhóm 3 câu của Part 3–4
(logic ở `ToeicMediaNaming.cs`).

Với đề Listening, **chỉ cần điền 8 trong 17 cột**:

| Phải điền | Để trống — hệ thống tự lo |
|---|---|
| `Part` | `AudioFile` (tự sinh) |
| `Content` | `ImageFile` (tự sinh) |
| `A`, `B`, `C`, `D` | `AudioUrl`, `ImageUrl` |
| `CorrectAnswer` | `Difficulty` → mặc định Medium |
| `OrderIndex` | `Tags`, `Passage`, `IsPublished` |

Điều kiện: import qua endpoint có `testId`, và đề đã có `Series` + `Title`.

Part 1–2 còn không cần `Content` (`QuestionService.cs:267` tự xử lý).

**Việc cần làm:** xác nhận xem hiện có đang điền tay `AudioFile`/`ImageFile` không.
Nếu có thì bỏ ngay — tiết kiệm ~400 ô mỗi đề, không cần sửa code.

---

## 3. Phần AI làm được tốt

Trích xuất **Reading (Part 5–7)** từ PDF chữ:

- Part 5: câu đơn, 4 đáp án — trích xuất gần như không sai
- Part 6–7: có đoạn văn, cần gom nhóm câu theo bài đọc
- Đáp án ở cuối file: cần map ngược về từng câu

Trích xuất **Listening (Part 1–4)**:

- Part 1: PDF chỉ có ảnh, không có text đáp án → **đáp án A/B/C/D nằm trong audio**,
  không có trong PDF. Chỉ lấy được ảnh + đáp án đúng từ trang cuối.
- Part 2: PDF thường không in đáp án (chỉ có trong audio script nếu sách có)
- Part 3–4: PDF có câu hỏi + 4 đáp án dạng text → trích xuất được

**Kèm luôn `Explanation`:** nhờ AI giải thích tại sao đáp án đúng, điền vào cột 4.
Giải quyết luôn phần "giống Zenlish" đã bàn (xem mục 7).

---

## 4. Phần khó: cắt ảnh Part 1

Part 1 mỗi câu một ảnh (6 ảnh mỗi đề, 60 ảnh mỗi bộ ETS). Ảnh nằm trong PDF, cần:

1. Tách ảnh khỏi PDF
2. Đặt tên đúng quy ước (`ETS26-T01-1.jpg`)

Nếu PDF là dạng chữ thật thì ảnh thường là object nhúng, tách được bằng công cụ
(`pdfimages`, `PyMuPDF`). Nếu PDF là scan thì mỗi trang là một ảnh lớn, phải **cắt
theo vùng** — khó tự động, có thể phải làm tay.

Đây là công đoạn cần xem form đề thật mới biết dễ hay khó.

---

## 5. Phần khó nhất: cắt audio

Phụ thuộc hoàn toàn vào dạng audio đang có:

| Dạng audio | Việc phải làm | Độ khó |
|---|---|---|
| Đã cắt sẵn theo câu | Chỉ đổi tên cho khớp quy ước | Dễ — script rename |
| Mỗi Part một file | Cắt nhỏ theo câu | Khó |
| Một file dài cho cả đề | Cắt theo câu | Khó nhất |

**Vì sao cắt audio khó:** phải biết chính xác mốc thời gian mỗi câu bắt đầu/kết thúc.
Không có metadata nên phải:

- Dò khoảng lặng (silence detection) — audio TOEIC có khoảng nghỉ giữa các câu, nhưng
  cũng có khoảng lặng *trong* câu, nên dễ cắt sai
- Hoặc nhận dạng giọng nói tìm câu "Number 7" / "Question 32" — chính xác hơn nhưng
  cần chạy speech-to-text toàn bộ file

Part 3–4 dễ hơn: 3 câu dùng chung 1 file, và audio có câu dẫn
"Questions 32 through 34 refer to the following conversation" — mốc rõ ràng.

**Cần biết trước khi làm:** dạng audio hiện tại là gì.

---

## 6. Hai lỗi trong luồng import hiện tại

Phát hiện khi đọc code, nên sửa bất kể phương án nào được chọn.

### 6.1. `SaveChangesAsync()` gọi trong vòng lặp

`QuestionService.cs:350-352`:

```csharp
await _uow.Repository<Question>().AddAsync(entity);
await _uow.SaveChangesAsync();   // ← trong vòng lặp qua từng dòng Excel
```

Hệ quả:

- **Chậm:** đề 200 câu = 200 round-trip xuống SQL Server
- **Không nguyên tử:** lỗi ở câu 150 thì 149 câu đầu đã nằm trong DB, 51 câu sau không
  có. Đề dở dang, phải dọn tay.

Comment trong code giải thích cần `QuestionId` ngay để gán vào `TestQuestion`. Nhưng
`Id` là `Guid` nên biết trước khi save — không cần save từng dòng.

**Sửa:** chuyển `SaveChangesAsync()` ra ngoài vòng lặp.

### 6.2. Excel đọc theo vị trí cột, không theo tên header

`QuestionService.cs:239-258` đọc cứng theo index:

```
1 Part | 2 Difficulty | 3 Content | 4 Explanation | 5 AudioUrl | 6 ImageUrl
7 Passage | 8 Tags | 9 IsPublished | 10 A | 11 B | 12 C | 13 D
14 CorrectAnswer | 15 OrderIndex | 16 AudioFile | 17 ImageFile
```

**Cảnh báo:** thêm cột mới **phải chèn vào cuối (18+)**. Chèn vào giữa sẽ làm mọi file
Excel cũ bị đọc lệch cột **mà không báo lỗi** — dữ liệu vào sai chỗ, im lặng.

---

## 7. Liên quan: cải tiến màn xem đáp án (Zenlish)

Đã bàn cùng lượt, ghi lại để không mất.

**Đã có sẵn trong schema** (`Question.cs`) — không cần migration:

- `Explanation` — chạy end-to-end: cột 4 Excel → form CM (`QuestionFormPage.tsx:214`)
  → render ở `ExamAnswerReviewPanel.tsx:282-287`
- `Passage` — Part 6–7
- `AiExplanation` — cache AI, chưa dùng

**Thiếu:** transcript (lời đoạn băng), bản dịch.

### Việc làm ngay được, không đụng DB

1. **Giải thích trình bày rõ hơn** — `ExamAnswerReviewPanel.tsx:282` đang dùng
   `text-xs text-muted-foreground` (chữ nhỏ nhất, màu mờ, nằm cuối card). Zenlish cho
   giải thích một khối riêng nền xanh, chữ đọc được. Đây là thứ người học đọc lâu nhất
   mà đang bị trình bày như chú thích chân trang.

2. **Ảnh Part 1 to hơn** — `ExamAnswerReviewPanel.tsx:326` dùng `grid md:grid-cols-2`
   cho Part 1 → ảnh bó trong nửa chiều rộng, `max-h-64` (dòng 336). Ảnh là dữ kiện duy
   nhất để trả lời, còn thanh audio chỉ cao ~40px. Cho ảnh full width, audio xuống dưới.

### Việc cần migration

3. **Transcript** — Part 3/4 hiện nhóm bằng *các câu liên tiếp cùng `audioUrl`*
   (`examListening.ts:49-60`), **không có entity nhóm**. Hai cách:

   - **Thêm `Transcript` vào `Question`** (khuyến nghị) — 3 câu cùng nhóm lặp cùng nội
     dung. Tốn vài KB, nhưng chỉ thêm 1 cột nullable + 1 cột Excel. Nhất quán với cách
     `AudioUrl`/`Passage` vốn đã lặp.
   - **Tạo entity nhóm** — đúng chuẩn hoá hơn, nhưng phải sửa import, cách nhóm ở cả FE
     và BE, và `TestSessionService` khi chấm. Rủi ro cao, đổi lấy sự đúng đắn người dùng
     không thấy.

   Mẹo giảm việc: thêm transcript vào **`PlayQuestionItem`** thay vì `SessionAnswerReview`
   — panel review đã join theo `questionId` (`ExamAnswerReviewPanel.tsx:42-46`), nên chỉ
   sửa 1 chỗ thay vì 3 (`TestSessionService.cs` dòng 478, 658, 850).

4. **Bản dịch** — Zenlish dịch cả 4 đáp án. `QuestionOption` chỉ có `Label`, `Content`,
   `IsCorrect` → muốn dịch riêng từng đáp án phải thêm cột vào bảng này nữa.

   Chi phí thật không phải code mà là **nội dung**: 200 câu × 4 đáp án = 800 câu dịch
   mỗi đề. Ba lựa chọn: dịch tay / AI dịch sẵn lưu DB / AI dịch on-demand.
   Nghiêng về **AI dịch sẵn lưu DB** — đọc nhiều lần, tạo một lần.

5. **Part 7 chưa có chữ** — cột `Passage` hiện thường chỉ chứa **mã nhóm** như
   `"151-154"` chứ không phải đoạn văn (`examReading.ts:38-41` có hàm
   `isPassageGroupCode`). Bài đọc thật đang là **ảnh**. Muốn Part 7 có chữ để dịch/tra từ
   thì là việc riêng, lớn hơn — cần OCR hoặc nhập tay.

---

## 8. Cần biết trước khi bắt đầu

- [ ] **Form đề thật** — chụp vài trang PDF (Part 1, Part 2, Part 3, Part 5, Part 7,
      và trang đáp án cuối file). Quyết định được cách trích xuất.
- [ ] **PDF là chữ thật hay scan?** Thử bôi đen + Ctrl+C. Copy được = chữ thật, trích
      xuất nhanh và chính xác. Không được = scan, phải dùng AI đọc ảnh, chậm hơn và cần
      soát lại.
- [ ] **Dạng audio** — một file dài mỗi đề? mỗi Part một file? hay đã cắt theo câu?
      Đây là thứ quyết định phần khó nhất (mục 5).
- [ ] **Đáp án ở cuối PDF trình bày thế nào?** Bảng? danh sách? có kèm giải thích không?

---

## 9. Thiết kế luồng import — dùng CHUNG cho localhost và production

Chốt sau khi bàn: chia theo **tính chất dữ liệu**, KHÔNG chia theo môi trường. Ý tưởng
"ZIP nhẹ cho production, ZIP đầy cho dev" đã bị loại — nó tạo 2 đường phải bảo trì và test.

| Dữ liệu | Tính chất | Xử lý |
|---|---|---|
| Audio / ảnh | Tĩnh, nặng (~22 MB/đề), **vốn đã idempotent** (ghi cùng tên = cùng file) | Upload **riêng**, từng file, chạy lại vô hại |
| Câu hỏi | Nhỏ (~100 KB), **phải nguyên tử** (200 câu hoặc 0 câu) | Upload **riêng**, 1 transaction |

Trộn hai thứ vào một request là gốc của mọi vấn đề: cái nặng gây timeout, cái cần nguyên tử
thì bị nửa vời.

```
① SYNC MEDIA   tool so file local ↔ server, chỉ up cái còn thiếu.
               540 request nhỏ. Đứt thì chạy lại, không mất gì.
               Dùng POST /api/media/audio?testId=  (ĐÃ CÓ, nhận multiple)

② DRY-RUN      POST xlsx (~100 KB) + ?dryRun=true
               Server kiểm TẤT CẢ, KHÔNG ghi gì, trả báo cáo trọn gói:
                 "200/200 dòng hợp lệ · thiếu 3 audio: E26-T01-45.mp3, …"
               Rẻ, không thể timeout, và trả lời được câu quan trọng nhất
               TRƯỚC KHI ghi: media đã có trên server chưa?

③ COMMIT       Cùng file, bỏ dryRun. MỘT transaction cho cả 200 câu.
               Dưới 1 giây. Không thể có trạng thái nửa vời.
```

### 🔴 Bốn việc phải sửa để thiết kế này đứng được

| # | Việc | Vì sao |
|---|---|---|
| 1 | `SaveChangesAsync()` **ra ngoài vòng lặp** | 200 round-trip → 1. Điều kiện để ③ nguyên tử |
| 2 | Thêm **`?dryRun=true`** | Không có nó thì ② không tồn tại, và buộc phải ghi để biết mình sai |
| 3 | **`ImportBatchKey`** trên `Question` | Xem dưới — thứ khiến "retry sau timeout" an toàn |
| 4 | Nginx **`proxy_read_timeout 300s`** (Day 53) | Kế hoạch chỉ có `client_max_body_size`. Mặc định 60s → 504 giữa lúc ghi |

### Vì sao cần `ImportBatchKey` — rủi ro chỉ xuất hiện ở production

`UpsertQuestionsByOrderAsync` ([TestService.cs:208](../backend/ToeicMasterPro.Infrastructure/Services/TestService.cs#L208))
chỉ xoá bản ghi `TestQuestion` (liên kết), **KHÔNG xoá `Question` gốc** — comment trong code
nói rõ. Nên import lại **không** duplicate trong đề, nhưng câu cũ thành **mồ côi** trong bảng
`Questions`. Import TEST 1 ba lần → 600 dòng, chỉ 200 được gán. Và khó xoá vì FK Restrict từ
`TestSessionAnswer` (đã va ở Day 47).

Ở localhost không gặp. Ở production: Nginx timeout 60s → thấy 504 → **không biết server ghi
xong chưa** → bấm Import lại. Đó chính là đường sinh câu mồ côi.

Cách vá: gắn khoá dạng `E26-T01-v1` lên `Question`; import lại cùng khoá thì **xoá hẳn batch
cũ** rồi ghi lại. Biến import từ *"cầu mong đừng lỗi"* thành *"lỗi thì bấm lại, không hậu quả"*.

### Ngưỡng chuyển sang Hangfire

Sau khi sửa việc 1, commit 200 câu mất **dưới 1 giây** → **chưa cần** job nền, thêm lúc này là
over-engineer. Nhưng đặt ngưỡng rõ để sau không phải tranh luận: **nếu commit vượt 10 giây**
(đề 1000 câu, hoặc DB ở máy khác), chuyển sang HTTP nhận file → đẩy Hangfire job → trả `jobId`
→ client hỏi tiến độ. Hangfire đã có sẵn.

### Không có UI cho tool, và không cần

Đầu ra của tool là **file** — mà UI nhận file thì đã có: `/cm/tests/:id/questions`,
`accept=".zip,.xlsx"`. Ở production chỉ khác tên miền. Bạn bấm đúng 2 nút: *Tạo đề* và *Import*.

Đưa phần nặng lên web nghĩa là: up 1 GB PDF lên VPS · API key AI nằm trên server (ai có quyền
CM đều tiêu tiền) · render PDF ngốn RAM trên VPS 4GB đang chạy SQL Server · phải làm job nền +
trang tiến độ. Đổi lấy một việc làm **10 lần trong đời**. Không đáng.

Nếu sau này người khác nhập đề: **bạn chạy tool → gửi họ file ZIP → họ up qua UI.** ZIP chính
là giao diện giữa hai người, không cần ai học dòng lệnh.

## 10. Thứ tự làm

```
✅ probe    — đo bộ đề, kiểm kê audio, phát hiện file rác
✅ names    — kiểm tên file trước khi tạo đề
✅ render   — PDFium rasterize trang → PNG, cache theo file
⬜ answers  — đọc bảng đáp án (LC 3 trang + RC + key rc), ĐỐI CHIẾU 2 nguồn, kiểm đếm
⬜ extract  — AI vision đọc trang → câu hỏi + 4 đáp án + đoạn văn + transcript
⬜ crop     — cắt ảnh Part 1 / Part 7 theo vùng, đặt tên đúng + lưới HTML để duyệt
⬜ explain  — AI viết Explanation, dùng transcript làm ngữ cảnh
⬜ validate — 6 mục kiểm, KHÔNG đạt thì KHÔNG xuất file
⬜ build    — xuất ZIP + trang HTML duyệt (ảnh trang gốc ‖ câu đã trích)
```

**Phía app, không phụ thuộc PDF/AI:**
```
✅ Cột Transcript (migration + cột 18 Excel + hiện ở màn review, KHÔNG ở màn thi)
⬜ SaveChangesAsync ra ngoài vòng lặp
⬜ ?dryRun=true
⬜ ImportBatchKey
⬜ Ghi Nginx proxy_read_timeout vào Day 53
```

**Làm 1 đề trước, đo, rồi mới chạy 10.** TEST 1 ≈ 74 trang → biết chi phí API thật và tỉ lệ AI
đọc sai. Sai <1% thì chạy tiếp; 1–5% thì sửa prompt chạy lại (cache nên rẻ); >5% thì đổi cách.
