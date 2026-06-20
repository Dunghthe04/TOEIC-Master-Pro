# 06 — Database Schema & Quan hệ các bảng

> EF Core 8 · SQL Server 2022 · ASP.NET Identity  
> 11 bảng · 4 domain · Fluent API Configurations

---

## Sơ đồ tổng quan

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DOMAIN: USER                                       │
│                          ┌────────────────┐                                     │
│                          │  AspNetUsers   │  (ApplicationUser)                  │
│                          │  ─────────────  │                                     │
│                          │  Id (PK)        │                                     │
│                          │  Email          │                                     │
│                          │  FullName       │                                     │
│                          │  TargetScore    │                                     │
│                          │  Plan (enum)    │                                     │
│                          │  XpPoints       │                                     │
│                          │  StreakDays     │                                     │
│                          └───────┬─────────┘                                     │
│               ┌──────────────────┼──────────────────┐                           │
│               ▼                  ▼                  ▼                           │
│       [TestSessions]    [UserVocabularies]  [UserExamReminders]                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                        DOMAIN: TEST                              │
│                                                                  │
│  ┌─────────┐   1:N   ┌───────────────┐   N:1  ┌────────────┐   │
│  │  Tests  │ ──────► │ TestQuestions │ ──────► │ Questions  │   │
│  └────┬────┘         └───────────────┘         └─────┬──────┘   │
│       │ 1:N                                          │ 1:N      │
│       ▼                                              ▼          │
│  ┌──────────────┐  1:N  ┌────────────────────┐  ┌────────────┐ │
│  │ TestSessions │ ────► │ TestSessionAnswers  │  │  Options   │ │
│  └──────────────┘       └────────────────────┘  └────────────┘ │
│                                │ N:1 (nullable)        ▲        │
│                                └──────────────────────►│        │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────┐
│         DOMAIN: VOCABULARY             │
│                                        │
│  ┌─────────────┐  1:N  ┌────────────┐  │
│  │ Vocabularies│ ────► │UserVocabs  │  │
│  └─────────────┘       └────────────┘  │
│                              │ N:1     │
│                              └──► Users│
└────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│           DOMAIN: EXAM SCHEDULE            │
│                                            │
│  ┌───────────────┐  1:N  ┌───────────────┐ │
│  │ ExamSchedules │ ────► │UserExamRemind.│ │
│  └───────────────┘       └───────────────┘ │
│                                │ N:1       │
│                                └──► Users  │
└────────────────────────────────────────────┘
```

---

## Chi tiết từng bảng

### 1. AspNetUsers *(User domain)*

Bảng trung tâm — mọi bảng liên quan đến người dùng đều FK vào đây. Kế thừa từ ASP.NET Identity nên các cột `Email`, `PasswordHash`, `PhoneNumber`... được Identity tự tạo. Ta chỉ thêm các cột tùy chỉnh cho nghiệp vụ TOEIC.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | Identity tự tạo |
| Email | string | Unique, Identity quản lý |
| FullName | string(100) | |
| TargetScore | int | Mục tiêu điểm TOEIC, mặc định 700 |
| Plan | SubscriptionPlan | Free / Premium / PremiumPlus |
| PlanExpiryDate | DateTime? | Null = Free |
| XpPoints | int | Tích lũy điểm gamification |
| StreakDays | int | Số ngày học liên tiếp |
| LastStudyDate | DateTime? | Dùng để tính streak |
| ExamDate | DateTime? | Ngày thi mục tiêu |

**Quan hệ:**
- → `TestSessions` (1:N, Restrict) — lịch sử thi
- → `UserVocabularies` (1:N, Cascade) — tiến trình học từ
- → `UserExamReminders` (1:N, Cascade) — đăng ký nhắc nhở

---

### 2. Questions *(Test domain)*

Kho câu hỏi trung tâm. Câu hỏi không gắn với đề thi cụ thể nào — chúng được tái sử dụng qua bảng `TestQuestions`. Một câu hỏi có thể xuất hiện trong nhiều đề thi khác nhau.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| Part | QuestionPart | Enum Part1–Part7 |
| Difficulty | DifficultyLevel | Easy / Medium / Hard |
| Content | string(2000) | Nội dung câu hỏi / câu lệnh |
| AudioUrl | string? | Part 1–4 có audio |
| ImageUrl | string? | Part 1, một số Part 2 |
| Passage | string(5000)? | Bài đọc Part 6–7 |
| Explanation | string(3000)? | Giải thích do người tạo viết |
| AiExplanation | string(5000)? | Cache giải thích từ Claude API |
| Tags | CSV string | Ví dụ: "grammar,tense,part5" |
| IsPublished | bool | false = đang soạn |

**AiExplanation** là cache: khi user yêu cầu AI giải thích lần đầu, kết quả được lưu vào cột này. Những lần sau dùng lại, không gọi API nữa → tiết kiệm chi phí.

**Quan hệ:**
- → `QuestionOptions` (1:N, Cascade) — 4 lựa chọn A/B/C/D
- ← `TestQuestions` (N:1) — thuộc nhiều đề thi
- ← `TestSessionAnswers` (N:1) — được trả lời trong nhiều lần thi

---

### 3. QuestionOptions *(Test domain)*

Các lựa chọn đáp án của câu hỏi. Mỗi câu hỏi có đúng 4 options (A, B, C, D), trong đó chính xác 1 option có `IsCorrect = true`.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| QuestionId | Guid FK | → Questions (Cascade) |
| Label | char(1) | "A", "B", "C", "D" |
| Content | string(1000) | Nội dung đáp án |
| IsCorrect | bool | Chỉ 1 option = true / câu |

**Quan hệ:**
- ← `Questions` (N:1, Cascade) — xóa Question thì xóa luôn tất cả Options

---

### 4. Tests *(Test domain)*

Đề thi được content manager tạo ra. Một đề thi không chứa câu hỏi trực tiếp mà thông qua bảng trung gian `TestQuestions`, giúp câu hỏi được tái sử dụng.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| Title | string(200) | Tên đề thi |
| Description | string(1000)? | Mô tả |
| DurationMinutes | int | Mặc định 120 (chuẩn TOEIC) |
| IsPublished | bool | false = chưa phát hành |
| CreatedByUserId | Guid | Admin / Content Manager |

**Quan hệ:**
- → `TestQuestions` (1:N, Cascade) — danh sách câu hỏi trong đề
- → `TestSessions` (1:N, Restrict) — các lần thi của đề này

---

### 5. TestQuestions *(Junction table)*

Bảng trung gian nối `Tests` ↔ `Questions` (quan hệ nhiều-nhiều). Ngoài ra lưu thêm `OrderIndex` để quy định thứ tự câu hỏi trong đề.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| TestId | Guid FK | → Tests (Cascade) |
| QuestionId | Guid FK | → Questions (Restrict) |
| OrderIndex | int | Thứ tự câu trong đề |

**Unique constraint:** `(TestId, QuestionId)` — không cho phép 1 câu xuất hiện 2 lần trong cùng đề.

**OnDelete logic:** Xóa Test → xóa TestQuestion nhưng **không** xóa Question gốc (Restrict) — câu hỏi trong kho vẫn còn dùng cho đề khác.

---

### 6. TestSessions *(Test domain)*

Ghi lại mỗi lần user ngồi làm bài thi. Một user có thể thi cùng 1 đề nhiều lần, mỗi lần là 1 Session riêng.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| UserId | Guid FK | → Users (Restrict) |
| TestId | Guid FK | → Tests (Restrict) |
| Status | TestSessionStatus | InProgress / Completed / Abandoned |
| StartedAt | DateTime | Tự điền khi tạo |
| CompletedAt | DateTime? | Null = chưa nộp |
| ListeningScore | int? | 5–495, tính sau khi nộp |
| ReadingScore | int? | 5–495 |
| TotalScore | int? | 10–990 |
| CorrectCount | int | Số câu đúng |
| TotalCount | int | Tổng số câu |

**OnDelete Restrict:** Xóa User hoặc Test **không** xóa lịch sử thi. Đây là dữ liệu cần giữ lại.

**Quan hệ:**
- → `TestSessionAnswers` (1:N, Cascade) — câu trả lời trong lần thi này

---

### 7. TestSessionAnswers *(Junction/detail table)*

Chi tiết câu trả lời của user trong từng lần thi. Đây là bảng quan trọng nhất cho analytics — dựa vào bảng này để phân tích điểm yếu của user theo Part, chủ đề.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| SessionId | Guid FK | → TestSessions (Cascade) |
| QuestionId | Guid FK | → Questions (Restrict) |
| SelectedOptionId | Guid? FK | → QuestionOptions (Restrict, **nullable**) |
| IsCorrect | bool | Backend tính, không trust frontend |

**SelectedOptionId nullable** = user bỏ qua câu hỏi (không chọn đáp án nào).

**Unique constraint:** `(SessionId, QuestionId)` — mỗi câu chỉ có 1 câu trả lời trong 1 lần thi.

---

### 8. Vocabularies *(Vocabulary domain)*

Kho từ vựng TOEIC do admin/content manager nhập. Không liên kết với Questions — đây là module học từ độc lập.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| Word | string(100) | Unique — không trùng từ |
| Phonetic | string? | /prəˌnʌnsiˈeɪʃən/ |
| Definition | string(500) | Nghĩa tiếng Việt |
| DefinitionEn | string? | Nghĩa tiếng Anh |
| ExampleSentence | string? | Câu ví dụ |
| AudioUrl | string? | File phát âm |
| Topic | VocabTopic | Business, Finance, Travel... |
| WordType | string | noun, verb, adjective... |

**Quan hệ:**
- → `UserVocabularies` (1:N, Cascade) — tiến trình học của từng user

---

### 9. UserVocabularies *(Vocabulary domain)*

Theo dõi tiến trình học từng từ của từng user theo thuật toán **SRS SM-2** (Spaced Repetition System). Mỗi lần user trả lời flashcard, hệ thống tính lại `EaseFactor`, `IntervalDays`, `NextReviewDate`.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| UserId | Guid FK | → Users (Cascade) |
| VocabularyId | Guid FK | → Vocabularies (Cascade) |
| RepetitionCount | int | Số lần đã ôn |
| EaseFactor | float | Mặc định 2.5 — càng cao càng dễ |
| IntervalDays | int | Số ngày đến lần ôn tiếp theo |
| NextReviewDate | DateTime | Frontend query cột này để hiện flashcard |
| IsLearned | bool | true khi IntervalDays > 21 |

**Unique constraint:** `(UserId, VocabularyId)` — mỗi user chỉ có 1 bản ghi SRS cho mỗi từ.

**Index:** `(UserId, NextReviewDate)` — query nhanh danh sách từ cần ôn hôm nay.

---

### 10. ExamSchedules *(Exam domain)*

Lịch thi TOEIC thật (IIG, British Council...) do admin cập nhật thủ công hoặc qua crawler. Hiển thị cho user để biết lịch và đăng ký.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| Title | string(200) | Tên kỳ thi |
| Organizer | string(100) | IIG Vietnam, British Council... |
| Location | string(300) | Địa điểm chi tiết |
| City | string(100) | Hà Nội, TP.HCM, Đà Nẵng... |
| ExamDate | DateTime | Ngày thi |
| RegistrationDeadline | DateTime | Hạn đăng ký |
| Fee | decimal(18,0) | Tiền VNĐ không có số thập phân |
| AvailableSlots | int? | Số chỗ còn lại |
| RegisterUrl | string? | Link redirect ra trang IIG/BC |
| IsActive | bool | false = đã hết hạn / hủy |

**Index:** `(City, ExamDate)` — filter lịch thi theo thành phố nhanh.

---

### 11. UserExamReminders *(Exam domain)*

User đăng ký nhận email nhắc nhở trước kỳ thi. Background job (Hangfire) sẽ query những record có `EmailSent = false` và gửi email trước ngày thi.

| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| Id | Guid PK | |
| UserId | Guid FK | → Users (Cascade) |
| ExamScheduleId | Guid FK | → ExamSchedules (Cascade) |
| EmailSent | bool | false = chưa gửi |

**Unique constraint:** `(UserId, ExamScheduleId)` — mỗi user chỉ đăng ký 1 lần nhắc cho 1 kỳ thi.

**Index:** `(EmailSent, UserId)` — background job batch query những reminder chưa gửi.

---

## Bảng tổng hợp quan hệ

| Từ bảng | Đến bảng | Kiểu | OnDelete | Ghi chú |
|---------|----------|------|----------|---------|
| AspNetUsers | TestSessions | 1 : N | Restrict | Giữ lịch sử thi khi xóa user |
| AspNetUsers | UserVocabularies | 1 : N | Cascade | Xóa user → xóa tiến trình từ |
| AspNetUsers | UserExamReminders | 1 : N | Cascade | |
| Tests | TestSessions | 1 : N | Restrict | Giữ lịch sử thi khi xóa đề |
| Tests | TestQuestions | 1 : N | Cascade | Xóa đề → xóa mapping câu hỏi |
| Questions | QuestionOptions | 1 : N | Cascade | Xóa câu → xóa luôn đáp án |
| Questions | TestQuestions | 1 : N | Restrict | Câu hỏi dùng chung nhiều đề |
| TestSessions | TestSessionAnswers | 1 : N | Cascade | Xóa session → xóa câu trả lời |
| TestQuestions | Questions | N : 1 | Restrict | Junction table |
| TestSessionAnswers | Questions | N : 1 | Restrict | |
| TestSessionAnswers | QuestionOptions | N : 1 | Restrict | **Nullable** — bỏ qua câu hỏi |
| Vocabularies | UserVocabularies | 1 : N | Cascade | |
| ExamSchedules | UserExamReminders | 1 : N | Cascade | |

---

## OnDelete — tại sao chọn Cascade hay Restrict?

**Cascade** — dùng khi child không có nghĩa khi tồn tại thiếu parent:
- `QuestionOptions` mất `Question` → options vô nghĩa
- `TestSessionAnswers` mất `TestSession` → câu trả lời của lần thi không còn giá trị
- `UserVocabularies` mất `User` → dữ liệu SRS không ai sở hữu

**Restrict** — dùng khi muốn giữ dữ liệu lịch sử:
- `TestSessions` không bị xóa khi xóa `User` hoặc `Test` — đây là audit trail
- `Questions` không bị xóa khi xóa `Test` — câu hỏi được tái sử dụng

---

## Index quan trọng

| Bảng | Index | Lý do |
|------|-------|-------|
| AspNetUsers | Email, Plan | Tìm user, filter theo gói |
| Questions | Part, Difficulty, IsPublished | Filter câu hỏi theo bộ lọc |
| TestSessions | (UserId, Status) | Lấy lịch sử thi của user |
| TestSessions | CompletedAt | Sort theo thời gian hoàn thành |
| TestQuestions | (TestId, QuestionId) UNIQUE | Tránh trùng câu trong đề |
| TestSessionAnswers | (SessionId, QuestionId) UNIQUE | Tránh trùng câu trả lời |
| UserVocabularies | (UserId, VocabularyId) UNIQUE | SRS — 1 user 1 bản ghi/từ |
| UserVocabularies | (UserId, NextReviewDate) | Lấy từ cần ôn hôm nay |
| ExamSchedules | (City, ExamDate) | Filter lịch thi theo thành phố |
| UserExamReminders | (UserId, ExamScheduleId) UNIQUE | Không đăng ký trùng |
| UserExamReminders | (EmailSent, UserId) | Background job batch gửi mail |
