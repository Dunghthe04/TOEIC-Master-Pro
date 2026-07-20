# TOEIC Master Pro

Nền tảng **thi thử TOEIC** (core) + công cụ phụ / AI (differentiator) — ưu tiên trải nghiệm làm đề giống format thật, sau đó cá nhân hóa lộ trình và giải thích đáp án.

---

## Tài liệu dự án

| # | File | Nội dung |
|---|---|---|
| 1 | [Tổng quan](docs/01-tong-quan.md) | So sánh với Zelish/ETS, điểm khác biệt, mô hình kinh doanh, yêu cầu phi tính năng |
| 2 | [Công nghệ](docs/02-cong-nghe.md) | Stack đầy đủ + giải thích từng công nghệ (Redis, MediatR, JWT, SignalR...) |
| 3 | [Clean Architecture](docs/03-clean-architecture.md) | Giải thích 4 layer, ví dụ code thực tế, luồng request, hướng dẫn Migrations |
| 4 | [Tính năng](docs/04-tinh-nang.md) | 10 module chi tiết (Auth, Practice, Mock Test, AI Coach, Vocab, Gamification...) |
| 5 | [Kế hoạch phát triển](docs/05-ke-hoach.md) | 72 ngày chia theo từng ngày, 6 phase |

---

## Kiến trúc nhanh

```
React Frontend
      │ HTTPS / WebSocket
ASP.NET Core 8 Web API
 ├── Domain      (Entities, Business Rules)
 ├── Application (Use Cases, CQRS, AI)
 └── Infrastructure (EF Core, Redis, Claude API)
      │              │
  SQL Server       Redis
```

---

## Khởi động môi trường dev

```bash
# 1. Chạy database + cache
docker compose up -d

# 2. Kiểm tra containers healthy
docker compose ps

# 3. Áp dụng migrations (lần đầu)
dotnet ef database update \
  --project backend/ToeicMasterPro.Infrastructure \
  --startup-project backend/ToeicMasterPro.API

# 4. Chạy API
dotnet run --project backend/ToeicMasterPro.API
```

---

## Phân quyền

| Role | Quyền |
|---|---|
| **Admin** | Quản lý user, analytics hệ thống, cấu hình, doanh thu |
| **Content Manager** | Upload đề thi, từ vựng, lịch thi, blog |
| **User** | Luyện tập, thi thử, học từ vựng, AI coach, leaderboard |
