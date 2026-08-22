# EtsImporter

Tool nhập đề ETS từ ZIP (PDF + audio) thành file import cho `POST /api/test/{id}/import-listening`.

Chạy tay, **cố ý không nằm trong `ToeicMasterPro.sln`** để không lọt vào build/test/CI của
production.

```bash
dotnet run --project tools/EtsImporter -- probe "D:\ETS2026.zip"
```

## Vì sao viết bằng C# chứ không Python

Tool tham chiếu `ToeicMasterPro.Application` để dùng **chung `ToeicMediaNaming`** với server.
Tên file audio/ảnh mà tool sinh ra và tên mà server mong đợi **không thể lệch nhau** vì cùng
một hàm. Viết lại quy ước bằng Python là tạo bản sao thứ hai, và bản sao sẽ lệch vào ngày ai
đó sửa một bên — mà hậu quả (mất audio) thì im lặng, không có lỗi nào báo.

Phụ: máy dev hiện không có Python, có .NET SDK.

## Lệnh

### `probe <zip>` — đo trước, viết sau

Đọc ZIP và báo cáo, **chưa trích xuất gì**. Trả lời 3 câu quyết định cách viết các bước sau:

1. **PDF là chữ thật hay scan?** → parse trực tiếp, hay phải OCR
2. **Ảnh Part 1 là object nhúng?** → lấy ra được, hay phải cắt theo vùng toạ độ
3. **Audio đủ 54 file × 10 đề chưa?** → thiếu đúng câu nào

Cách viết phần trích xuất phụ thuộc **hoàn toàn** vào loại PDF, và hai cách không dùng lại
được gì của nhau. Đoán sai là viết lại từ đầu.

## Ba cái bẫy tool này tồn tại để chặn

### 1. File rác macOS — làm số audio nhìn vào GẤP ĐÔI thực tế

Bộ ETS nén trên máy Mac nên mỗi file audio có một file bạn đồng hành:

```
E26-T08-83-85.mp3     456.198 bytes   ← audio thật
._E26-T08-83-85.mp3       187 bytes   ← AppleDouble, RÁC
```

Để lọt vào import thì server nhận một `.mp3` "hợp lệ" 187 byte mà không câu nào tham chiếu.
Tệ hơn lỗi: bạn **tưởng đã đủ audio** trong khi có thể đang thiếu. Tool lọc `._*`,
`__MACOSX/`, `.DS_Store` và **báo số lượng đã lọc** chứ không im lặng bỏ qua.

### 2. `Series` sai → mất TOÀN BỘ audio, không có lỗi nào báo

`ToeicMediaNaming.ToExamCode("ETS 2026")` trả **`ETS2026`**, KHÔNG phải `E26` — vì sau khi bỏ
dấu cách thì `"ETS2026"` khớp ngay nhánh regex đầu (`^[A-Za-z]{1,6}\d{1,4}$`) và nhánh rút gọn
năm không bao giờ chạy.

Đặt `Series = "ETS 2026"` thì server tự sinh tên `ETS2026-T01-1.mp3` trong khi file thật tên
`E26-T01-1.mp3` → **mọi câu Listening mất audio**, mà import vẫn báo thành công. Đến lúc thi
mới phát hiện không có tiếng.

Tool đọc mã đề từ **chính tên file thật** rồi in ra giá trị `Series` phải đặt. Đúng cho `E26`:

```
Series = "E26"   (hoặc "ETS-2026", "ETS_2026")
```

### 3. Thiếu audio — 2000 câu không ai soát tay được

Một đề TOEIC Listening cần đúng **54 file** (không phải 100): Part 1 sáu file, Part 2 hai mươi
lăm, Part 3 mười ba nhóm, Part 4 mười nhóm — vì Part 3–4 ba câu dùng chung một file.

Danh sách mong đợi được sinh bằng chính `ToeicMediaNaming.GetAudioOrderRange`, nên nếu quy ước
đổi thì tool tự đổi theo. Tên file thật được chuẩn hoá bằng `NormalizeMediaFileName` trước khi
so — đúng cái server làm, nên `E26-T01-01.mp3` khớp `E26-T01-1.mp3` mà không phải đổi tên gì.

## Chưa làm

`extract`, `answers`, `explain`, `validate`, `build` — xem `docs/13-task-nhap-de-tu-pdf.md`.
Chờ kết quả `probe` trên bộ đề thật để biết PDF thuộc loại nào.
