# Tổng quan dự án

**TOEIC Master Pro** là nền tảng **thi thử TOEIC trực tuyến** — ưu tiên trải nghiệm làm đề giống thi thật; sau đó mới là các tính năng phụ và khác biệt (AI, SRS, lịch thi…).

### Ưu tiên sản phẩm

1. **Core — Thi thử / làm đề** (list đề → full test hoặc chọn Part → intro Part + audio → làm bài → nộp → kết quả). UX phải rõ, mượt, cạnh tranh các site test online hiện có.
2. **Phụ** — Luyện Part nhanh, từ vựng SRS, lịch thi…
3. **Khác biệt** — AI giải thích, study plan, score predictor, chatbot, gamification… (làm sau khi core ổn).

---

<details>
<summary>📊 So sánh với các nền tảng hiện có</summary>

| Tính năng | TOEIC Master Pro | Zelish | ETS Practice | TOEIC Online |
|---|---|---|---|---|
| Đề thi thử chuẩn | ✅ | ✅ | ✅ | ✅ |
| Giải thích đáp án | ✅ (AI) | Thủ công | Thủ công | Thủ công |
| Lộ trình cá nhân hóa | ✅ AI-driven | ❌ | ❌ | ❌ |
| Chatbot hỏi đáp 24/7 | ✅ | ❌ | ❌ | ❌ |
| Lịch thi cập nhật live | ✅ | ❌ | ❌ | Thủ công |
| Adaptive Testing | ✅ | ❌ | ❌ | ❌ |
| Phân tích điểm yếu AI | ✅ | Cơ bản | ❌ | ❌ |
| Gamification | ✅ | Cơ bản | ❌ | ❌ |
| Từ vựng Spaced Repetition | ✅ | ✅ | ❌ | ❌ |
| Cộng đồng học tập | ✅ | ❌ | ❌ | ❌ |
| Dự đoán điểm số | ✅ AI | ❌ | ❌ | ❌ |

</details>

---

<details>
<summary>⭐ Điểm khác biệt cốt lõi</summary>

### 0. Exam Engine chất lượng cao (Core trước)
Thi thử giống đề thật: full / chọn Part, intro Part + audio Listening, layout từng Part, timer TOEIC — trải nghiệm rõ, mượt hơn site chỉ “làm đề cơ bản”.

### 1. AI Study Coach (sau khi core ổn)
- **AI giải thích đáp án** — *tại sao* đúng/sai, ngữ pháp, từ vựng liên quan.
- **Lộ trình học cá nhân hóa** — dựa trên kết quả bài thi.
- **Dự đoán điểm TOEIC** — từ lịch sử làm bài.
- **Chatbot hỏi đáp** — ngữ pháp, từ vựng bất kỳ lúc nào.

### 2. Adaptive Testing Engine
Điều chỉnh độ khó theo năng lực (IRT) — Phase sau.

### 3. Lịch thi TOEIC Live
Cập nhật lịch thi IIG, BC Việt Nam. Đặt nhắc nhở, export iCal.

### 4. Gamification thực sự
Streak, huy hiệu, bảng xếp hạng, thi đấu 1v1.

### 5. Vocabulary Ecosystem
SRS (SM-2). Gợi ý từ dựa trên lỗi sai.

</details>

---

<details>
<summary>💰 Mô hình kinh doanh</summary>

| Gói | Giá | Tính năng |
|---|---|---|
| Free | 0đ | 10 đề luyện/tháng, 1 mock test/tháng, 500 từ vựng |
| Premium | 99.000đ/tháng | Không giới hạn, AI giải thích, lộ trình cá nhân, chatbot |
| Premium Plus | 199.000đ/tháng | Tất cả + 1v1 challenge, score prediction, priority support |

</details>

---

<details>
<summary>📋 Yêu cầu phi tính năng</summary>

| Mục | Yêu cầu |
|---|---|
| Hiệu năng | API response < 200ms (p95), Load ≤ 500 concurrent users |
| Bảo mật | OWASP Top 10, HTTPS, JWT có expiry, Rate limiting |
| Khả năng mở rộng | Horizontal scaling, Redis cache cho hot data |
| Khả dụng | Uptime 99.5%, zero-downtime deploy |
| SEO | Server-side rendering cho trang landing/blog |
| Mobile | Responsive 100%, PWA support |
| GDPR | Xóa tài khoản theo yêu cầu, không bán dữ liệu |

</details>
