# Quy ước đặt tên file media (Listening)

Tài liệu này mô tả **cách đặt tên file audio/ảnh** khi import đề TOEIC vào hệ thống.  
Logic chính thức nằm ở `ToeicMediaNaming.cs` (backend) và `toeicMediaNaming.ts` (frontend).

---

## 1. Công thức chung

```
{MãĐề}-{MãTest}-{SốCâu}.mp3          ← Part 1, 2 (1 câu / 1 file)
{MãĐề}-{MãTest}-{Từ}-{Đến}.mp3       ← Part 3, 4 (3 câu / 1 file)
```

| Thành phần | Lấy từ đâu | Ví dụ |
|------------|------------|-------|
| **MãĐề** | Field `Series` của đề thi | `ETS26`, `E26` |
| **MãTest** | Field `Title` của đề thi (số trong tên) | `TEST 1` → `T01` |
| **SốCâu** | `OrderIndex` trong đề (1–100) | Câu 7 → `7` |

**Ví dụ đầy đủ** — đề `TEST 1`, Series `ETS26`:

| Part | OrderIndex | Tên file audio |
|------|------------|----------------|
| 1 | 1 | `ETS26-T01-1.mp3` |
| 1 | 6 | `ETS26-T01-6.mp3` |
| 2 | 7 | `ETS26-T01-7.mp3` |
| 2 | 31 | `ETS26-T01-31.mp3` |
| 3 | 32–34 | `ETS26-T01-32-34.mp3` (3 dòng Excel, cùng 1 file) |
| 3 | 35–37 | `ETS26-T01-35-37.mp3` |
| 4 | 71–73 | `ETS26-T01-71-73.mp3` |
| 4 | 98–100 | `ETS26-T01-98-100.mp3` |

Ảnh Part 1: **cùng quy tắc**, đổi đuôi `.jpg` hoặc `.png`  
(ví dụ `ETS26-T01-1.png`).

---

## 2. Cách sinh MãĐề (`Series`)

Hệ thống đọc field **Series** trên đề thi:

| Series trong DB | MãĐề dùng trong tên file |
|-----------------|---------------------------|
| `ETS26` | `ETS26` |
| `E26` | `E26` |
| `ETS 2026` | `E26` (lấy từ năm 2026) |
| `Cambridge 2024` | `CAM` (3 chữ cái đầu) |

> **Quan trọng:** Tên file trên disk **phải khớp chính xác** MãĐề mà hệ thống sinh ra từ `Series`.  
> Ví dụ: Series = `ETS26` → file phải là `ETS26-T01-7.mp3`, **không** dùng `E26-T01-7.mp3` (trừ khi bạn tự ghi `AudioFile` trong Excel và chấp nhận không dùng auto).

**Khuyến nghị:** Chọn **một** dạng MãĐề và giữ cố định cho cả đề (ví dụ luôn `ETS26` hoặc luôn `E26`).

---

## 3. Cách sinh MãTest (`Title`)

Lấy **số đầu tiên** trong tên đề, pad 2 chữ số:

| Title | MãTest |
|-------|--------|
| `TEST 1` | `T01` |
| `Test 12` | `T12` |
| `Đề thử 3` | `T03` |

---

## 4. Ánh xạ OrderIndex theo Part

| Part | OrderIndex | Số file audio | Ghi chú |
|------|------------|---------------|---------|
| 1 | 1 – 6 | 6 file | 1 câu / 1 ảnh / 1 audio |
| 2 | 7 – 31 | 25 file | 1 câu / 1 audio, không ảnh |
| 3 | 32 – 70 | 13 file | 3 câu / 1 audio |
| 4 | 71 – 100 | 10 file | 3 câu / 1 audio |

### Part 3 — nhóm 3 câu

| OrderIndex (3 dòng Excel) | Tên file |
|---------------------------|----------|
| 32, 33, 34 | `…-32-34.mp3` |
| 35, 36, 37 | `…-35-37.mp3` |
| … | … |
| 68, 69, 70 | `…-68-70.mp3` |

### Part 4 — nhóm 3 câu

| OrderIndex (3 dòng Excel) | Tên file |
|---------------------------|----------|
| 71, 72, 73 | `…-71-73.mp3` |
| … | … |
| 98, 99, 100 | `…-98-100.mp3` |

---

## 5. Quy tắc số trong tên file

### ✅ Đúng

```
ETS26-T01-7.mp3
ETS26-T01-31.mp3
ETS26-T01-32-34.mp3
```

### ❌ Sai (thường gây 404)

```
ETS26-T01-07.mp3     ← không pad số 0 (câu đơn)
E26-T01-7.mp3        ← khác MãĐề với Series=ETS26
7.mp3                ← thiếu MãĐề-MãTest
ETS26-T01-7.MP3      ← OK về logic, nhưng nên dùng .mp3 thường
```

**Chuẩn hóa khi import ZIP:** Hệ thống tự đổi `07` → `7` (`NormalizeMediaFileName`).  
Tuy nhiên **nên đặt đúng ngay từ đầu** để tránh nhầm lẫn.

**Lưu ý:** Với dạng khoảng (Part 3–4), **giữ nguyên** hai số: `32-34` là đúng, không rút thành `32-4`.

---

## 6. Cấu trúc ZIP khi import

```
goi-part2.zip
├── questions.xlsx
├── audio/
│   ├── ETS26-T01-7.mp3
│   ├── ETS26-T01-8.mp3
│   └── …
└── images/              ← chỉ Part 1
    ├── ETS26-T01-1.png
    └── …
```

- File Excel **bắt buộc** tên `questions.xlsx` (hoặc bất kỳ `.xlsx` nào trong ZIP).
- Audio đặt trong thư mục `audio/` (hoặc đường dẫn con có `/audio/`).
- Ảnh Part 1 đặt trong `images/`.

Sau import, file được lưu tại:

```
wwwroot/uploads/tests/{testId}/audio/{tên-file}.mp3
wwwroot/uploads/tests/{testId}/images/{tên-file}.png
```

URL trong DB: `/uploads/tests/{testId}/audio/ETS26-T01-7.mp3`

---

## 7. Cột Excel liên quan

| Cột | Bắt buộc | Ghi chú |
|-----|----------|---------|
| `OrderIndex` | Có (khi import vào đề) | Số thứ tự câu trong đề 1–100 |
| `AudioFile` | Không | Để **trống** → hệ thống tự sinh tên theo Series + Title + Part + OrderIndex |
| `ImageFile` | Không (Part 1) | Để trống → tự sinh; đuôi mặc định `.jpg` |
| `AudioUrl` | Không | Thường để trống; chỉ dùng khi file host ngoài |
| `ImageUrl` | Không | Tương tự |

**Cách làm đơn giản nhất:**  
1. Tạo đề với `Series` + `Title` đúng.  
2. Excel: điền `Part`, `OrderIndex`, đáp án…  
3. Để trống `AudioFile` / `ImageFile`.  
4. ZIP: đặt file audio/ảnh **đúng tên auto** (xem preview trên CM trước khi import).

---

## 8. Nội dung Excel theo Part (thi thử)

### Part 1 (OrderIndex 1–6)

| Cột | Giá trị |
|-----|---------|
| Content | Để trống (ẩn khi thi) |
| A, B, C, D | Transcript 4 đáp án |
| CorrectAnswer | A / B / C / D |
| AudioFile | (trống hoặc `ETS26-T01-1.mp3`) |
| ImageFile | (trống hoặc `ETS26-T01-1.png`) |

### Part 2 (OrderIndex 7–31)

| Cột | Giá trị |
|-----|---------|
| Content | Có thể có (ẩn khi thi) |
| A, B, C | Chỉ 3 đáp án |
| D | Để trống |
| CorrectAnswer | A / B / C |
| AudioFile | (trống hoặc `ETS26-T01-7.mp3`) |

### Part 3 (OrderIndex 32–70)

- 3 dòng liên tiếp / 1 đoạn hội thoại.
- Cùng `AudioFile` (hoặc trống → cùng tên auto `…-32-34.mp3`).
- Mỗi dòng 1 câu hỏi + 4 đáp án A–D.

### Part 4 (OrderIndex 71–100)

- Giống Part 3, bắt đầu từ 71.

---

## 9. Directions (hướng dẫn Part) — không theo quy tắc trên

Audio/ảnh hướng dẫn **cố định**, nằm trong frontend:

```
frontend/public/exam/directions/part1.png
frontend/public/exam/directions/audio/part1.mp3
… part2 … part7
```

Không đặt trong ZIP đề thi.

---

## 10. Checklist trước khi import

- [ ] `Series` và `Title` đề đã đúng (ví dụ `ETS26` + `TEST 1`).
- [ ] `OrderIndex` khớp Part (1–6, 7–31, 32–70, 71–100).
- [ ] Tên file audio **không có số 0 đứng trước** (`7` không phải `07`).
- [ ] Part 3–4: 3 dòng Excel dùng **cùng một** tên file audio.
- [ ] MãĐề trong tên file **trùng** với `Series` (hoặc để trống `AudioFile` và đặt file theo tên auto).
- [ ] ZIP có `questions.xlsx` + thư mục `audio/` (và `images/` nếu Part 1).
- [ ] Không import cùng Part 2 lần hai nếu chưa xóa câu cũ (hệ thống upsert theo `OrderIndex` nhưng nên tránh import trùng).

---

## 11. Ví dụ nhanh — TEST 1, Series `ETS26`

```
audio/
  ETS26-T01-1.mp3 … ETS26-T01-6.mp3      # Part 1
  ETS26-T01-7.mp3 … ETS26-T01-31.mp3     # Part 2
  ETS26-T01-32-34.mp3 … ETS26-T01-68-70.mp3   # Part 3
  ETS26-T01-71-73.mp3 … ETS26-T01-98-100.mp3  # Part 4

images/
  ETS26-T01-1.png … ETS26-T01-6.png      # Part 1
```

---

## 12. Sửa lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|-------------|-------------|----------|
| Audio 0:00 / 404 | Tên file khác DB (`E26` vs `ETS26`, `07` vs `7`) | Đổi tên file cho khớp URL trong CM, hoặc sửa `AudioFile` + import lại |
| Part 2 dừng ở câu 7 | Thiếu file `…-7.mp3` trên disk | Thêm file vào `uploads/tests/{id}/audio/` |
| Ảnh Part 1 không hiện | Sai tên hoặc thiếu trong `images/` | Kiểm tra `ImageFile` / tên file |
| Import 2 lần bị trùng câu | Import trước khi có upsert | Xóa câu thừa trên CM hoặc import lại 1 lần |
