# Task: Nhập đề ETS từ PDF + audio bằng AI

**Trạng thái:** đang bàn, chưa code
**Ngày lập:** 22/08/2026

Tài liệu này ghi lại vấn đề, những gì đã kiểm tra được trong code, và các phương án —
để bàn tiếp và quyết. **Chưa có gì được triển khai.**

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

## 9. Đề xuất thứ tự làm

1. **Không code:** xác nhận việc gõ thừa `AudioFile`/`ImageFile` (mục 2)
2. **Làm ngay, rẻ:** giải thích trình bày rõ hơn + ảnh Part 1 to hơn (mục 7.1, 7.2) —
   chỉ CSS, không cần nội dung mới, hiệu quả thị giác lớn nhất
3. **Sau khi xem form đề:** script AI trích xuất PDF → Excel (chạy ngoài app, không
   đụng code production)
4. **Sửa luồng import:** lỗi 200-lần-save + thêm chế độ dry-run (validate không ghi DB,
   báo trọn gói "thiếu 3 audio, 2 dòng sai đáp án" trước khi import thật)
5. **Đợt sau:** transcript, bản dịch
