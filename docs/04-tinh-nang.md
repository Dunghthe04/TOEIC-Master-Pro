# Tính năng chi tiết

> **Thứ tự ưu tiên:** Core (thi thử) → phụ (luyện / vocab / lịch) → khác biệt (AI, gamification…).
>
> **Role:** chi tiết Day theo `User` / `ContentManager` / `Admin` xem bảng trong [`05-ke-hoach.md`](05-ke-hoach.md) (mục *Day theo role*).

| Role | Module chính |
|------|----------------|
| **User** | Mock Test (core), Practice phụ, Vocab, lịch thi, analytics, AI, gamification |
| **Content Manager** | Quản lý câu hỏi, đề thi, import, vocab, lịch thi (nội dung) |
| **Admin** | Dashboard, quản lý user/CM, duyệt content, subscription (Day 55+) |

---

<details>
<summary>⭐ Module 0 — Định hướng sản phẩm</summary>

### Core — lý do user vào web
- **Thi thử / làm đề TOEIC** từ đề import (ETS-style, 200 câu L&R)
- Chọn đề → Full test (mặc định) hoặc chọn từng Part → intro Part (+ audio Listening) → làm bài → nộp → kết quả
- Timer full ~**120 phút** = Listening ~**45′** (gồm Directions) + Reading **75′**; không chọn độ khó khi làm đề
- UX tham chiếu site thi thử (vd. Zenlish), hướng tới mượt / rõ hơn

### Phụ & khác biệt — làm sau core
- Luyện nhanh random theo Part (Practice API)
- Từ vựng SRS, lịch thi, AI, gamification, community…

</details>

<details>
<summary>⏱️ Module 1 — Mock Test / Exam Engine (CORE)</summary>

- Danh sách đề published (theo series / card: TEST 1 – ETS 2026…)
- Màn cấu trúc đề: bảng Part + số câu; ☐ Chọn từng Part (off = full test)
- Intro mỗi Part — **Directions**:
  - Ảnh Directions cố định (`/exam/directions/`); Listening Part 1–4 thêm audio intro
  - Nút **Next / Bắt đầu** chỉ hiện ở màn Directions (bỏ qua, làm luôn); **không** hiện khi đang làm câu
  - Hết audio Directions (hoặc bấm Next) → vào câu
- Listening — audio **playlist liền mạch** (preload track kế; `ended` → play ngay, không nghỉ giữa file):
  - Part 1–2: 1 file / 1 câu; Part 3–4: 1 file / nhóm 3 câu (cùng `AudioUrl`, UI hiện 3 câu)
  - Thời lượng Listening ≈ tổng duration Directions + file câu (hoặc cố định ~45′); Reading countdown 75′
- Layout theo Part:
  - Part 1: ảnh + audio + A/B/C/D
  - Part 2: audio + A/B/C (thường 3 đáp án)
  - Part 3–4: audio đoạn + nhóm 3 câu cùng lúc
  - Part 5: câu điền khuyết + Câu tiếp
  - Part 6–7: passage trái + câu phải; bookmark
- Header: PART X | đã làm/tổng | Timer | NỘP BÀI
- Kết quả: điểm quy đổi, phân tích theo Part, review đáp án
- Lịch sử thi, so sánh tiến độ (Day 31+)

</details>

<details>
<summary>👤 Module 2 — Authentication & User Profile</summary>

- Đăng ký / Đăng nhập (Email + Password, Google OAuth)
- Xác thực email
- Quản lý hồ sơ: ảnh đại diện, mục tiêu điểm, ngày thi dự kiến
- Thay đổi mật khẩu, quên mật khẩu
- Subscription / Gói miễn phí vs Premium

</details>

<details>
<summary>📝 Module 3 — Practice Engine (PHỤ — luyện nhanh)</summary>

- Luyện nhanh từ kho câu hỏi (không bắt buộc gắn đề đủ 200 câu)
- Filter: Part, độ khó, tag
- Nộp bài → xem kết quả ngay (API Day 25)
- Bookmark câu hỏi (sau)
- AI giải thích từng câu sai (Phase 4)

> Không thay thế Mock Test. Menu chính ưu tiên **Thi thử**.

</details>

<details>
<summary>🤖 Module 4 — AI Study Coach (Differentiator)</summary>

- **Smart Explanation** — Giải thích tại sao đáp án đúng (song ngữ Việt-Anh)
- **Study Plan Generator** — Nhập mục tiêu + ngày thi → AI tạo kế hoạch hằng ngày
- **Score Predictor** — Phân tích lịch sử → dự đoán điểm thi thật
- **Chatbot Q&A** — Hỏi về ngữ pháp, từ vựng, tips TOEIC 24/7
- **Weak Area Alert** — Tự động nhận diện Part/chủ đề yếu → gợi ý đề tương ứng

</details>

<details>
<summary>📚 Module 5 — Vocabulary System</summary>

- Thư viện 3000+ từ vựng TOEIC, phân theo chủ đề
- Flashcard với SRS (Spaced Repetition, thuật toán SM-2)
- Nghe phát âm (TTS)
- Bài tập: chọn nghĩa, điền từ, nghe chọn từ
- AI gợi ý từ cần ôn dựa trên lỗi sai

</details>

<details>
<summary>📅 Module 6 — Lịch thi TOEIC</summary>

- Hiển thị lịch thi IIG, BC Vietnam, các trung tâm (CM nhập thủ công)
- Lọc theo tỉnh/thành phố, tháng
- Đặt nhắc nhở qua Email / thông báo web
- Export Google Calendar / iCal
- Content Manager cập nhật qua bảng điều khiển

</details>

<details>
<summary>🏆 Module 7 — Gamification</summary>

- Daily Streak (chuỗi ngày học liên tiếp)
- XP Points (kiếm qua làm bài, học từ, streak)
- Huy hiệu (Badges): Level 1–10, thành tích đặc biệt
- Leaderboard: tuần, tháng, toàn thời gian
- 1v1 Challenge: thi đấu thời gian thực với bạn bè

</details>

<details>
<summary>💬 Module 8 — Community</summary>

- Diễn đàn hỏi đáp theo chủ đề
- Chia sẻ tips, kinh nghiệm thi
- Like, comment, bookmark bài viết

</details>

<details>
<summary>📊 Module 9 — Analytics (Người dùng)</summary>

- Dashboard cá nhân: điểm trung bình, số bài đã làm, từ đã học
- Biểu đồ tiến độ theo tuần/tháng
- Phân tích điểm yếu theo Part, chủ đề, loại câu hỏi
- So sánh với trung bình người dùng cùng mục tiêu

</details>

<details>
<summary>⚙️ Module 10 — Admin Dashboard</summary>

- Thống kê: số user, DAU/MAU, bài thi hoàn thành, tỉ lệ đăng ký Premium
- Quản lý user: tìm kiếm, khóa tài khoản, xem lịch sử
- Quản lý content: danh sách đề thi, trạng thái (nháp/công khai)
- Quản lý gói subscription, doanh thu

</details>
