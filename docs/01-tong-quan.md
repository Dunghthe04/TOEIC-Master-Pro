# Tổng quan dự án

**TOEIC Master Pro** là nền tảng luyện thi TOEIC trực tuyến thế hệ mới, tích hợp AI để cá nhân hóa lộ trình học tập, giúp người dùng đạt điểm mục tiêu nhanh hơn và hiệu quả hơn.

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

### 1. AI Study Coach
- **AI giải thích đáp án** — Không chỉ nói đáp án đúng, AI giải thích *tại sao* A đúng, *tại sao* B/C/D sai, liên kết ngữ pháp, từ vựng liên quan.
- **Lộ trình học cá nhân hóa** — Dựa trên kết quả bài thi, AI tạo kế hoạch học từng ngày.
- **Dự đoán điểm TOEIC** — Phân tích lịch sử làm bài → ước tính điểm thi thật với độ chính xác 85–90%.
- **Chatbot hỏi đáp** — Người dùng hỏi về ngữ pháp, từ vựng bất kỳ lúc nào.

### 2. Adaptive Testing Engine
Hệ thống tự động điều chỉnh độ khó câu hỏi theo năng lực thực tế (IRT - Item Response Theory). Học ít hơn, hiệu quả hơn.

### 3. Lịch thi TOEIC Live
Cập nhật lịch thi IIG, BC Việt Nam tự động. Đặt nhắc nhở, export Google Calendar / iCal.

### 4. Gamification thực sự
Streak hằng ngày, huy hiệu, bảng xếp hạng tuần/tháng, thi đấu 1v1 real-time.

### 5. Vocabulary Ecosystem
Spaced Repetition System (SRS) theo thuật toán SM-2. Gợi ý từ dựa trên lỗi sai của từng người.

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
