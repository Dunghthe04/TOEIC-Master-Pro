using ToeicMasterPro.Application.Common;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.TestSessions;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services;

/// <summary>
/// Day 28 — Logic phiên thi: Start / SaveAnswers / Submit.
///
/// Luồng:
///   StartAsync       → tạo TestSession (InProgress) + lưu PartsFilter
///   SaveAnswersAsync → upsert TestSessionAnswer (đáp án tạm, chưa chấm)
///   SubmitAsync      → chấm điểm, ghi điểm, Status = Completed
/// </summary>
public class TestSessionService : ITestSessionService
{
    private readonly IUnitOfWork _uow;

    public TestSessionService(IUnitOfWork uow) => _uow = uow;

    /// <summary>
    /// Reading section của TOEIC là 75 phút.
    /// Phải khớp READING_SECTION_SECONDS ở frontend — bước 5 sẽ bỏ hằng số bên đó
    /// đi để chỉ còn MỘT nguồn sự thật là con số này.
    /// </summary>
    private const int ReadingSectionMinutes = 75;


    /// <summary>
    /// Biên độ dư cho thời gian đọc directions, màn nghỉ giữa section, lệch đồng hồ
    /// máy khách và độ trễ mạng. Mục tiêu là chặn "nộp bài sau ba ngày", không phải
    /// bắt bẻ từng phút — nên thà rộng tay còn hơn cắt oan bài của người dùng.
    /// </summary>
    private const int GraceMinutes = 5;

    /// <summary>
    /// Trần tuyệt đối cho một phiên — KHÔNG phải luật thi, chỉ để phiên bỏ dở không
    /// nằm InProgress vĩnh viễn (chính thứ đã đẻ ra 82 phiên rác trong DB).
    /// </summary>
    private const int SessionMaxHours = 24;

    /// <summary>
    /// Số giây Reading còn lại, tính từ ReadingStartedAt.
    ///   null = chưa vào Reading (frontend không hiện đồng hồ)
    ///   0    = đã hết giờ
    ///
    /// Lưu ý về Kind: ReadingStartedAt đọc từ SQL Server về mang Kind = Unspecified,
    /// còn DateTime.UtcNow là Kind = Utc. Phép trừ trong C# bỏ qua Kind, chỉ trừ tick —
    /// nên kết quả ĐÚNG vì ta luôn GHI bằng UtcNow. Nếu sau này có chỗ nào ghi giờ
    /// địa phương vào cột này thì phép tính sẽ lệch đúng bằng chênh múi giờ.
    /// </summary>
    /// 
    private static int? ComputeReadingSecondsLeft(TestSession session)
    {
        if (session.ReadingStartedAt is null) return null;

        var deadline = session.ReadingStartedAt.Value.AddMinutes(ReadingSectionMinutes);
        var left = (deadline - DateTime.UtcNow).TotalSeconds;
        return left <= 0 ? 0 : (int)Math.Ceiling(left);
    }


    /// <summary>
    /// Thời điểm phiên hết hạn.
    ///   · Chưa vào Reading → chỉ có trần 24h
    ///   · Đã vào Reading   → ReadingStartedAt + 75 phút — đây mới là hạn thật
    ///
    /// VÌ SAO LISTENING KHÔNG BỊ BÓ GIỜ — quyết định có cân nhắc, không phải bỏ sót:
    /// ETS quy định Listening 45 phút, nhưng trong phòng thi thật con số đó được thực
    /// thi BẰNG CHÍNH CUỐN BĂNG chạy liên tục, không phải bằng đồng hồ thí sinh nhìn.
    /// App này cũng vậy: audio tạo bằng `new Audio()` KHÔNG có controls — không pause,
    /// không tua, không nghe lại — và trình duyệt vẫn phát đúng tốc độ khi tab ở nền.
    /// Băng chính là đồng hồ.
    ///
    /// Reading thì ngược lại: không có gì điều nhịp, nên bắt buộc phải neo vào server
    /// (CWE-602 — giờ phía client chỉ được dùng để hiển thị).
    ///
    /// Hệ quả chấp nhận: phiên có thể kéo dài nhiều giờ nếu user bỏ dở rồi quay lại.
    /// Điểm số VẪN hợp lệ vì từng phần đều được điều nhịp đúng — tính hợp lệ đến từ
    /// nhịp của từng section, không phải từ tổng thời gian đồng hồ treo tường.
    /// Xem lại nếu sau này có bảng xếp hạng hoặc điểm dùng để so giữa người dùng.
    /// </summary>
    private static DateTime ComputeDeadline(TestSession session)
    {
        var hardCap = session.StartedAt.AddHours(SessionMaxHours);

        if (session.ReadingStartedAt is null) return hardCap;

        var readingDeadline = session.ReadingStartedAt.Value
            .AddMinutes(ReadingSectionMinutes + GraceMinutes);

        return readingDeadline < hardCap ? readingDeadline : hardCap;
    }
    // ═══════════════════════════════════════════════════════════════════════
    // START — Bắt đầu phiên thi
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestSessionStartedResponse>> StartAsync(Guid userId, StartTestSessionRequest req)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(req.TestId);
        if (test is null || !test.IsPublished)
            return Result<TestSessionStartedResponse>.NotFound("Không tìm thấy đề thi hoặc chưa publish.");

        // Chuẩn hóa parts: chỉ giữ số 1–7, bỏ trùng
        var partsArr = NormalizeParts(req.Parts);
        var partsFilterStr = partsArr is null ? null : string.Join(",", partsArr);

        // Đếm số câu trong phạm vi user chọn (giống GET /play)
        var questionCount = await CountQuestionsInScopeAsync(req.TestId, partsArr);
        if (questionCount == 0)
            return Result<TestSessionStartedResponse>.Failure("Đề không có câu hỏi phù hợp filter Part.");

        var existing = (await _uow.Repository<TestSession>().FindAsync(s =>
           s.UserId == userId &&
           s.TestId == req.TestId &&
           s.Status == TestSessionStatus.InProgress &&
           s.PartsFilter == partsFilterStr))
       .OrderByDescending(s => s.StartedAt)
       .FirstOrDefault();
        // ── Phiên quá hạn thì ĐÓNG LẠI, không khôi phục ──
        // Thiếu nhánh này thì bước 2 và bước 4 đánh nhau: user bỏ dở 2 ngày rồi quay
        // lại sẽ được StartAsync trả về đúng phiên đã chết đó, mà SaveAnswers thì chặn
        // mọi thao tác vì quá hạn → bị nhốt trong bài thi không làm gì được, cũng
        // không bắt đầu lại được.
        // Đây cũng là chỗ TỰ DỌN RÁC: phiên bỏ dở tự chuyển Abandoned khi user quay
        // lại, không cần job quét định kỳ.
        if (existing is not null && DateTime.UtcNow > ComputeDeadline(existing))
        {
            existing.Status = TestSessionStatus.Abandoned;
            existing.SetUpdatedAt();
            _uow.Repository<TestSession>().Update(existing);
            await _uow.SaveChangesAsync();
            existing = null;   // rơi xuống nhánh tạo phiên mới bên dưới
        }

        if (existing is not null)
        {
            var savedAnswers = (await _uow.Repository<TestSessionAnswer>()
                    .FindAsync(a => a.SessionId == existing.Id))
                .Select(a => new SessionAnswerItem(a.QuestionId, a.SelectedOptionId))
                .ToList();

            return Result<TestSessionStartedResponse>.Success(new TestSessionStartedResponse(
                existing.Id,
                test.Id,
                test.Title,
                existing.Status,
                existing.StartedAt,   // GIỮ mốc cũ — không được làm mới, nếu không là reset đồng hồ
                partsArr,
                questionCount,
                Resumed: true,
                Answers: savedAnswers,
                ReadingStartedAt: existing.ReadingStartedAt,
                ReadingSecondsLeft: ComputeReadingSecondsLeft(existing)
            ));
        }

        // ── Không có phiên dở → tạo mới như cũ ──
        var session = new TestSession
        {
            UserId = userId,
            TestId = req.TestId,
            Status = TestSessionStatus.InProgress,
            StartedAt = DateTime.UtcNow,
            PartsFilter = partsFilterStr,
        };

        await _uow.Repository<TestSession>().AddAsync(session);
        await _uow.SaveChangesAsync();

        return Result<TestSessionStartedResponse>.Success(new TestSessionStartedResponse(
            session.Id,
            test.Id,
            test.Title,
            session.Status,
            session.StartedAt,
            partsArr,
            questionCount,
            Resumed: false,
            Answers: [],
            ReadingStartedAt: null,
            ReadingSecondsLeft: null
        ));
    }

    /// <inheritdoc />

    public async Task<Result<int?>> MarkReadingStartedAsync(Guid userId, Guid sessionId)
    {
        var session = await _uow.Repository<TestSession>().GetByIdAsync(sessionId);

        // Gộp "không tồn tại" và "của người khác" thành CÙNG MỘT phản hồi 404 với CÙNG
        // MỘT thông báo. Trước đây hai trường hợp trả hai message khác nhau (cùng 400)
        // → kẻ tấn công dò sessionId biết được id nào tồn tại, và message còn xác nhận
        // thẳng "phiên này của người khác" (IDOR information disclosure).
        if (session is null || session.UserId != userId)
            return Result<int?>.NotFound("Không tìm thấy phiên thi.");

        // 409 chứ không 400: phiên thi TỒN TẠI và bạn CÓ quyền, chỉ là trạng thái hiện
        // tại không cho phép hành động này. 400 nghĩa là "dữ liệu bạn gửi sai" — không đúng.
        if (session.Status != TestSessionStatus.InProgress)
            return Result<int?>.Conflict("Phiên thi đã kết thúc.");

        if (session.ReadingStartedAt is null)
        {
            session.ReadingStartedAt = DateTime.UtcNow;
            session.SetUpdatedAt();
            _uow.Repository<TestSession>().Update(session);
            await _uow.SaveChangesAsync();
        }
        return Result<int?>.Success(ComputeReadingSecondsLeft(session));
    }

    /// <inheritdoc />
    public async Task<Result<ActiveTestSessionResponse?>> GetActiveAsync(Guid userId, Guid testId)
    {
        // KHÔNG lọc theo PartsFilter: ở màn cấu trúc, user chưa quyết định phạm vi.
        // Câu hỏi đúng là "đề này có bài dở nào không", không phải "có bài dở đúng
        // phạm vi tôi đang tick".
        var session = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId &&
                s.TestId == testId &&
                s.Status == TestSessionStatus.InProgress))
            .OrderByDescending(s => s.StartedAt)
            .FirstOrDefault();

        if (session is null)
            return Result<ActiveTestSessionResponse?>.Success(null);

        // Quá hạn thì đóng luôn và coi như không có — DÙNG CHUNG luật với StartAsync.
        // Thiếu chỗ này thì banner sẽ mời user "tiếp tục bài còn 0 phút", bấm vào lại
        // được cấp phiên mới tinh — thông báo nói dối, còn tệ hơn không có thông báo.
        if (DateTime.UtcNow > ComputeDeadline(session))
        {
            session.Status = TestSessionStatus.Abandoned;
            session.SetUpdatedAt();
            _uow.Repository<TestSession>().Update(session);
            await _uow.SaveChangesAsync();
            return Result<ActiveTestSessionResponse?>.Success(null);
        }

        var test = await _uow.Repository<Test>().GetByIdAsync(testId);
        var partsArr = ParsePartsFilter(session.PartsFilter);

        // Chỉ đếm câu THẬT SỰ đã chọn — SelectedOptionId null là câu bỏ qua.
        var answered = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == session.Id && a.SelectedOptionId != null)).Count;

        return Result<ActiveTestSessionResponse?>.Success(new ActiveTestSessionResponse(
            session.Id,
            testId,
            test?.Title ?? string.Empty,
            session.StartedAt,
            partsArr,
            answered,
            await CountQuestionsInScopeAsync(testId, partsArr),
            ComputeReadingSecondsLeft(session)
        ));
    }

    /// <inheritdoc />
    public async Task<Result> AbandonAsync(Guid userId, Guid sessionId)
    {
        var session = await _uow.Repository<TestSession>().GetByIdAsync(sessionId);

        // 404 chung cho "không tồn tại" và "của người khác" — xem lý do ở MarkReadingStartedAsync.
        if (session is null || session.UserId != userId)
            return Result.NotFound("Không tìm thấy phiên thi.");
        if (session.Status != TestSessionStatus.InProgress)
            return Result.Conflict("Phiên thi đã kết thúc.");

        session.Status = TestSessionStatus.Abandoned;
        session.SetUpdatedAt();
        _uow.Repository<TestSession>().Update(session);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }
    // ═══════════════════════════════════════════════════════════════════════
    // SAVE ANSWERS — Lưu đáp án tạm (upsert)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<int>> SaveAnswersAsync(
        Guid userId,
        Guid sessionId,
        SaveSessionAnswersRequest req)
    {
        if (req.Answers is null || req.Answers.Count == 0)
            return Result<int>.Failure("Chưa có đáp án nào.");

        // ── Kiểm tra session hợp lệ ──
        var session = await _uow.Repository<TestSession>().GetByIdAsync(sessionId);
        // 404 chung cho "không tồn tại" và "của người khác" — xem MarkReadingStartedAsync.
        if (session is null || session.UserId != userId)
            return Result<int>.NotFound("Không tìm thấy phiên thi.");
        if (session.Status != TestSessionStatus.InProgress)
            return Result<int>.Conflict("Phiên thi đã kết thúc — không thể sửa đáp án.");
        // ── Hết giờ thì không cho ghi thêm ──
        // Kiểm Status là CHƯA ĐỦ: phiên hết giờ vẫn đang InProgress. Không chặn ở
        // đây thì user thi hôm nay, mai mở lại trả lời tiếp rồi nộp — và chặn ở
        // Submit cũng vô ích, vì lúc đó đáp án đã nằm sẵn trong DB rồi.
        if (DateTime.UtcNow > ComputeDeadline(session))
            return Result<int>.Conflict("Đã hết giờ làm bài — không thể lưu thêm đáp án.");
        // Tập QuestionId hợp lệ trong phạm vi session (đề + parts filter)
        var partsArr = ParsePartsFilter(session.PartsFilter);
        var allowedIds = await GetQuestionIdsInScopeAsync(session.TestId, partsArr);

        // Đáp án đã lưu trước đó — key = QuestionId
        var existing = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == sessionId))
            .ToDictionary(a => a.QuestionId);

        // Dedupe payload theo QuestionId TRƯỚC khi loop — dictionary "existing" chỉ
        // phản ánh dữ liệu ĐÃ CÓ TRONG DB, không cập nhật theo item vừa xử lý trong
        // loop. Payload có 2 item cùng QuestionId (debounce/race ở FE gửi trùng) thì
        // CẢ HAI đều "miss" existing và cùng rơi vào nhánh insert → 2 dòng cùng
        // (SessionId, QuestionId) → vi phạm unique index → DbUpdateException.
        // Giữ item CUỐI cùng — đó là giá trị user chọn sau cùng, mới nhất.
        var dedupedAnswers = req.Answers
            .GroupBy(a => a.QuestionId)
            .Select(g => g.Last())
            .ToList();

        // QuestionId → tập OptionId hợp lệ CỦA ĐÚNG câu đó — để chặn SelectedOptionId
        // "lạc đề" (thuộc câu khác, hoặc GUID không tồn tại) trước khi ghi xuống DB.
        var validOptionIdsByQuestion = (await _uow.Repository<QuestionOption>()
                .FindAsync(o => allowedIds.Contains(o.QuestionId)))
            .GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.Select(o => o.Id).ToHashSet());

        var saved = 0;
        foreach (var item in dedupedAnswers)
        {
            if (!allowedIds.Contains(item.QuestionId))
                return Result<int>.Failure($"Câu {item.QuestionId} không thuộc phạm vi phiên thi này.");

            // SelectedOptionId null = bỏ qua câu hỏi, hợp lệ. Có giá trị thì phải là
            // 1 trong các option CỦA ĐÚNG QuestionId này — không cho "lạc" sang câu khác.
            if (item.SelectedOptionId is not null &&
                (!validOptionIdsByQuestion.TryGetValue(item.QuestionId, out var validOptionIds) ||
                 !validOptionIds.Contains(item.SelectedOptionId.Value)))
            {
                return Result<int>.Failure($"Đáp án chọn không hợp lệ cho câu {item.QuestionId}.");
            }

            if (existing.TryGetValue(item.QuestionId, out var row))
            {
                // Upsert — UPDATE: user đổi đáp án
                row.SelectedOptionId = item.SelectedOptionId;
                row.SetUpdatedAt();
                _uow.Repository<TestSessionAnswer>().Update(row);
            }
            else
            {
                // Upsert — INSERT: lần đầu chọn câu này
                await _uow.Repository<TestSessionAnswer>().AddAsync(new TestSessionAnswer
                {
                    SessionId = sessionId,
                    QuestionId = item.QuestionId,
                    SelectedOptionId = item.SelectedOptionId,
                    IsCorrect = false, // chưa chấm — Submit mới gán đúng/sai
                });
            }
            saved++;
        }

        session.SetUpdatedAt();
        _uow.Repository<TestSession>().Update(session);
        await _uow.SaveChangesAsync();
        return Result<int>.Success(saved);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUBMIT — Nộp bài + chấm điểm
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestSessionSubmitResponse>> SubmitAsync(Guid userId, Guid sessionId)
    {
        var session = await _uow.Repository<TestSession>().GetByIdAsync(sessionId);
        // 404 chung cho "không tồn tại" và "của người khác" — xem MarkReadingStartedAsync.
        if (session is null || session.UserId != userId)
            return Result<TestSessionSubmitResponse>.NotFound("Không tìm thấy phiên thi.");
        // 409: nộp lại phiên đã nộp là XUNG ĐỘT TRẠNG THÁI, không phải dữ liệu sai.
        if (session.Status != TestSessionStatus.InProgress)
            return Result<TestSessionSubmitResponse>.Conflict("Phiên thi đã được nộp trước đó.");
        // ── Quá hạn thì VẪN CHẤM ──
        // Từ chối sẽ phạt oan người mất mạng đúng lúc hết giờ, và làm phiên kẹt
        // InProgress vĩnh viễn — không nộp được, cũng không xem lại được.
        // An toàn vì SaveAnswers (4.4) đã chặn ghi sau hạn: đáp án trong DB chắc
        // chắn là những gì user làm được TRONG giờ.
        var submitDeadline = ComputeDeadline(session);
        // ── Lấy tất cả câu trong phạm vi session ──
        var partsArr = ParsePartsFilter(session.PartsFilter);
        var scopeQuestions = await GetScopedQuestionsAsync(session.TestId, partsArr);
        if (scopeQuestions.Count == 0)
            return Result<TestSessionSubmitResponse>.Failure("Phiên thi không có câu hỏi để chấm.");

        var qIds = scopeQuestions.Select(x => x.Question.Id).ToList();
        var options = await _uow.Repository<QuestionOption>()
            .FindAsync(o => qIds.Contains(o.QuestionId));
        var optByQ = options.GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.ToList());

        // Đáp án user đã lưu tạm
        var savedAnswers = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == sessionId))
            .ToDictionary(a => a.QuestionId);

        var reviews = new List<SessionAnswerReview>();
        var correctTotal = 0;
        var skippedTotal = 0;
        var listeningCorrect = 0;
        var listeningTotal = 0;
        var readingCorrect = 0;
        var readingTotal = 0;
        var partStats = new Dictionary<int, (int Correct, int Total, int Skipped)>();

        foreach (var (tq, q) in scopeQuestions)
        {
            var opts = optByQ.GetValueOrDefault(q.Id) ?? [];
            var correctOpt = opts.FirstOrDefault(o => o.IsCorrect);
            if (correctOpt is null)
                return Result<TestSessionSubmitResponse>.Failure(
                    $"Câu OrderIndex {tq.OrderIndex} chưa có đáp án đúng trong DB.");

            savedAnswers.TryGetValue(q.Id, out var ansRow);
            var selectedId = ansRow?.SelectedOptionId;
            var isSkipped = selectedId is null;
            if (isSkipped) skippedTotal++;
            var isCorrect = !isSkipped && selectedId == correctOpt.Id;
            if (isCorrect) correctTotal++;

            // Tách Listening (1–4) vs Reading (5–7) để tính điểm section
            var partNum = (int)q.Part;
            if (partNum <= 4)
            {
                listeningTotal++;
                if (isCorrect) listeningCorrect++;
            }
            else
            {
                readingTotal++;
                if (isCorrect) readingCorrect++;
            }

            // Gom thống kê theo Part (Day 30 Phần 2)
            if (!partStats.TryGetValue(partNum, out var ps))
                ps = (0, 0, 0);
            partStats[partNum] = (
                ps.Correct + (isCorrect ? 1 : 0),
                ps.Total + 1,
                ps.Skipped + (isSkipped ? 1 : 0));

            // Cập nhật hoặc tạo bản ghi answer kèm IsCorrect
            if (ansRow is not null)
            {
                ansRow.IsCorrect = isCorrect;
                ansRow.SelectedOptionId = selectedId;
                _uow.Repository<TestSessionAnswer>().Update(ansRow);
            }
            else
            {
                // User không chọn → vẫn ghi dòng (skipped)
                await _uow.Repository<TestSessionAnswer>().AddAsync(new TestSessionAnswer
                {
                    SessionId = sessionId,
                    QuestionId = q.Id,
                    SelectedOptionId = null,
                    IsCorrect = false,
                });
            }

            reviews.Add(new SessionAnswerReview(
                q.Id,
                tq.OrderIndex,
                q.Part.ToString(),
                selectedId,
                correctOpt.Id,
                correctOpt.Label,
                isCorrect,
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation,
                // Transcript CHỈ ra ở đây — sau khi đã nộp bài. Không bao giờ ở
                // PlayQuestionItem (payload lúc đang thi), xem SessionAnswerReview.
                string.IsNullOrWhiteSpace(q.Transcript) ? null : q.Transcript
            ));
        }

        var listeningScore = ToeicScoreHelper.ConvertSectionScore(
            listeningCorrect, listeningTotal, ToeicScoredSection.Listening);
        var readingScore = ToeicScoreHelper.ConvertSectionScore(
            readingCorrect, readingTotal, ToeicScoredSection.Reading);
        int? totalScore = null;
        if (listeningScore.HasValue && readingScore.HasValue)
            totalScore = listeningScore + readingScore;
        else if (listeningScore.HasValue)
            totalScore = listeningScore;
        else if (readingScore.HasValue)
            totalScore = readingScore;

        var partBreakdown = PartBreakdownBuilder.Build(partStats);

        var completedAt = DateTime.UtcNow > submitDeadline ? submitDeadline : DateTime.UtcNow;
        session.Status = TestSessionStatus.Completed;
        session.CompletedAt = completedAt;
        session.CorrectCount = correctTotal;
        session.TotalCount = scopeQuestions.Count;
        session.ListeningScore = listeningScore;
        session.ReadingScore = readingScore;
        session.TotalScore = totalScore;
        session.SetUpdatedAt();
        _uow.Repository<TestSession>().Update(session);
        await _uow.SaveChangesAsync();

        return Result<TestSessionSubmitResponse>.Success(new TestSessionSubmitResponse(
            session.Id,
            correctTotal,
            scopeQuestions.Count,
            skippedTotal,
            listeningScore,
            readingScore,
            totalScore,
            completedAt,
            partBreakdown,
            reviews
        ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Helper — dùng chung Start / Save / Submit
    // ═══════════════════════════════════════════════════════════════════════

    /// <summary>Lọc parts hợp lệ 1–7; null/empty = full test.</summary>
    private static int[]? NormalizeParts(int[]? parts)
    {
        if (parts is null || parts.Length == 0) return null;
        var arr = parts.Where(p => p >= 1 && p <= 7).Distinct().OrderBy(p => p).ToArray();
        return arr.Length == 0 ? null : arr;
    }

    /// <summary>"1,2,5" → [1,2,5]; null → full.</summary>
    private static int[]? ParsePartsFilter(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return null;
        var arr = stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(s => int.TryParse(s, out var n) ? n : -1)
            .Where(n => n >= 1 && n <= 7)
            .Distinct()
            .OrderBy(n => n)
            .ToArray();
        return arr.Length == 0 ? null : arr;
    }

    private async Task<int> CountQuestionsInScopeAsync(Guid testId, int[]? parts)
    {
        var list = await GetScopedQuestionsAsync(testId, parts);
        return list.Count;
    }

    private async Task<HashSet<Guid>> GetQuestionIdsInScopeAsync(Guid testId, int[]? parts)
    {
        var list = await GetScopedQuestionsAsync(testId, parts);
        return list.Select(x => x.Question.Id).ToHashSet();
    }

    /// <summary>
    /// Câu hỏi thuộc đề + lọc Part — sắp xếp OrderIndex.
    /// Trả (TestQuestion, Question) để có OrderIndex khi review.
    /// </summary>
    private async Task<List<(TestQuestion Tq, Question Question)>> GetScopedQuestionsAsync(
        Guid testId,
        int[]? parts)
    {
        var tqs = (await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == testId))
            .OrderBy(tq => tq.OrderIndex)
            .ToList();
        if (tqs.Count == 0) return [];

        var qIds = tqs.Select(tq => tq.QuestionId).ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        var qDict = questions.ToDictionary(q => q.Id);

        HashSet<QuestionPart>? partFilter = null;
        if (parts is { Length: > 0 })
            partFilter = parts.Select(p => (QuestionPart)p).ToHashSet();

        var result = new List<(TestQuestion, Question)>();
        foreach (var tq in tqs)
        {
            if (!qDict.TryGetValue(tq.QuestionId, out var q)) continue;
            if (partFilter is not null && !partFilter.Contains(q.Part)) continue;
            result.Add((tq, q));
        }
        return result;
    }

    /// <summary>
    /// Chấm lại từ mọi dòng TestSessionAnswers — dùng khi đề đã đổi câu nên scope hiện tại không map được đáp án cũ.
    /// </summary>
    private async Task<SavedAnswersGrading> GradeFromSavedAnswersAsync(Guid sessionId, Guid testId)
    {
        var answerRows = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == sessionId)).ToList();
        if (answerRows.Count == 0)
            return SavedAnswersGrading.Empty;

        var qIds = answerRows.Select(a => a.QuestionId).Distinct().ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        var qDict = questions.ToDictionary(q => q.Id);
        var options = await _uow.Repository<QuestionOption>().FindAsync(o => qIds.Contains(o.QuestionId));
        var optByQ = options.GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.ToList());
        var tqs = await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == testId);
        var orderByQ = tqs.ToDictionary(tq => tq.QuestionId, tq => tq.OrderIndex);

        var reviews = new List<SessionAnswerReview>();
        var partStats = new Dictionary<int, (int Correct, int Total, int Skipped)>();
        var correctTotal = 0;
        var skippedTotal = 0;
        var listeningCorrect = 0;
        var listeningTotal = 0;
        var readingCorrect = 0;
        var readingTotal = 0;

        foreach (var ans in answerRows.OrderBy(a => orderByQ.GetValueOrDefault(a.QuestionId, int.MaxValue)))
        {
            if (!qDict.TryGetValue(ans.QuestionId, out var q)) continue;
            var opts = optByQ.GetValueOrDefault(q.Id) ?? [];
            var correctOpt = opts.FirstOrDefault(o => o.IsCorrect);
            if (correctOpt is null) continue;

            var selectedId = ans.SelectedOptionId;
            var isSkipped = selectedId is null;
            if (isSkipped) skippedTotal++;
            var isCorrect = !isSkipped && selectedId == correctOpt.Id;
            if (isCorrect) correctTotal++;

            var partNum = (int)q.Part;
            if (partNum <= 4)
            {
                listeningTotal++;
                if (isCorrect) listeningCorrect++;
            }
            else
            {
                readingTotal++;
                if (isCorrect) readingCorrect++;
            }

            if (!partStats.TryGetValue(partNum, out var ps))
                ps = (0, 0, 0);
            partStats[partNum] = (
                ps.Correct + (isCorrect ? 1 : 0),
                ps.Total + 1,
                ps.Skipped + (isSkipped ? 1 : 0));

            reviews.Add(new SessionAnswerReview(
                q.Id,
                orderByQ.GetValueOrDefault(q.Id, 0),
                q.Part.ToString(),
                selectedId,
                correctOpt.Id,
                correctOpt.Label,
                isCorrect,
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation,
                // Transcript CHỈ ra ở đây — sau khi đã nộp bài. Không bao giờ ở
                // PlayQuestionItem (payload lúc đang thi), xem SessionAnswerReview.
                string.IsNullOrWhiteSpace(q.Transcript) ? null : q.Transcript
            ));
        }

        return new SavedAnswersGrading(
            reviews,
            PartBreakdownBuilder.Build(partStats),
            correctTotal,
            skippedTotal,
            listeningCorrect,
            listeningTotal,
            readingCorrect,
            readingTotal
        );
    }

    private static (int? Listening, int? Reading, int? Total) ComputeSectionScores(
        int listeningCorrect,
        int listeningTotal,
        int readingCorrect,
        int readingTotal)
    {
        var listeningScore = ToeicScoreHelper.ConvertSectionScore(
            listeningCorrect, listeningTotal, ToeicScoredSection.Listening);
        var readingScore = ToeicScoreHelper.ConvertSectionScore(
            readingCorrect, readingTotal, ToeicScoredSection.Reading);
        int? totalScore = null;
        if (listeningScore.HasValue && readingScore.HasValue)
            totalScore = listeningScore + readingScore;
        else if (listeningScore.HasValue)
            totalScore = listeningScore;
        else if (readingScore.HasValue)
            totalScore = readingScore;
        return (listeningScore, readingScore, totalScore);
    }

    private sealed record SavedAnswersGrading(
        List<SessionAnswerReview> Reviews,
        List<PartBreakdownItem> PartBreakdown,
        int CorrectTotal,
        int SkippedTotal,
        int ListeningCorrect,
        int ListeningTotal,
        int ReadingCorrect,
        int ReadingTotal)
    {
        public static SavedAnswersGrading Empty { get; } = new(
            [], [], 0, 0, 0, 0, 0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HISTORY — Lịch sử thi (Day 31 Bước 1)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestSessionHistoryResponse>> GetHistoryAsync(
        Guid userId,
        Guid? testId = null,
        int page = 1,
        int pageSize = 20)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var sessions = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId
                && s.Status == TestSessionStatus.Completed
                && (!testId.HasValue || s.TestId == testId.Value)))
            .OrderByDescending(s => s.CompletedAt ?? s.StartedAt)
            .ToList();

        var total = sessions.Count;
        var pageItems = sessions
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var testIds = pageItems.Select(s => s.TestId).Distinct().ToList();
        var tests = testIds.Count > 0
            ? await _uow.Repository<Test>().FindAsync(t => testIds.Contains(t.Id))
            : Array.Empty<Test>();
        var testDict = tests.ToDictionary(t => t.Id);

        var items = pageItems.Select(s =>
        {
            testDict.TryGetValue(s.TestId, out var test);
            return new TestSessionHistoryItem(
                s.Id,
                s.TestId,
                test?.Title ?? string.Empty,
                test?.Series ?? string.Empty,
                s.StartedAt,
                s.CompletedAt ?? s.StartedAt,
                ParsePartsFilter(s.PartsFilter),
                s.ListeningScore,
                s.ReadingScore,
                s.TotalScore,
                s.CorrectCount ?? 0,
                s.TotalCount ?? 0
            );
        }).ToList();

        return Result<TestSessionHistoryResponse>.Success(
            new TestSessionHistoryResponse(items, total, page, pageSize));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DETAIL — Xem lại 1 lần thi (Day 31 Bước 2)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestSessionDetailResponse>> GetDetailAsync(Guid userId, Guid sessionId)
    {
        var session = await _uow.Repository<TestSession>().GetByIdAsync(sessionId);
        // 404 chung cho "không tồn tại" và "của người khác" — endpoint này là chỗ dễ
        // bị dò nhất (user chỉ cần đổi sessionId trên URL xem lại kết quả người khác).
        if (session is null || session.UserId != userId)
            return Result<TestSessionDetailResponse>.NotFound("Không tìm thấy phiên thi.");
        if (session.Status != TestSessionStatus.Completed)
            return Result<TestSessionDetailResponse>.Conflict("Chỉ xem được phiên đã nộp bài.");

        var test = await _uow.Repository<Test>().GetByIdAsync(session.TestId);
        if (test is null)
            return Result<TestSessionDetailResponse>.NotFound("Không tìm thấy đề thi.");

        var partsArr = ParsePartsFilter(session.PartsFilter);
        var scopeQuestions = await GetScopedQuestionsAsync(session.TestId, partsArr);
        if (scopeQuestions.Count == 0)
            return Result<TestSessionDetailResponse>.Failure("Phiên thi không có câu hỏi.");

        var qIds = scopeQuestions.Select(x => x.Question.Id).ToList();
        var options = await _uow.Repository<QuestionOption>()
            .FindAsync(o => qIds.Contains(o.QuestionId));
        var optByQ = options.GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var savedAnswers = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == sessionId))
            .ToDictionary(a => a.QuestionId);

        var reviews = new List<SessionAnswerReview>();
        var correctTotal = 0;
        var skippedTotal = 0;
        var listeningCorrect = 0;
        var listeningTotal = 0;
        var readingCorrect = 0;
        var readingTotal = 0;
        var partStats = new Dictionary<int, (int Correct, int Total, int Skipped)>();

        foreach (var (tq, q) in scopeQuestions)
        {
            var opts = optByQ.GetValueOrDefault(q.Id) ?? [];
            var correctOpt = opts.FirstOrDefault(o => o.IsCorrect);
            if (correctOpt is null)
                return Result<TestSessionDetailResponse>.Failure(
                    $"Câu OrderIndex {tq.OrderIndex} chưa có đáp án đúng trong DB.");

            savedAnswers.TryGetValue(q.Id, out var ansRow);
            var selectedId = ansRow?.SelectedOptionId;
            var isSkipped = selectedId is null;
            if (isSkipped) skippedTotal++;
            // Tính lại đúng/sai từ đáp án đã chọn — không tin cột IsCorrect (có thể chưa cập nhật)
            var isCorrect = !isSkipped && selectedId == correctOpt.Id;
            if (isCorrect) correctTotal++;

            var partNum = (int)q.Part;
            if (partNum <= 4)
            {
                listeningTotal++;
                if (isCorrect) listeningCorrect++;
            }
            else
            {
                readingTotal++;
                if (isCorrect) readingCorrect++;
            }

            if (!partStats.TryGetValue(partNum, out var ps))
                ps = (0, 0, 0);
            partStats[partNum] = (
                ps.Correct + (isCorrect ? 1 : 0),
                ps.Total + 1,
                ps.Skipped + (isSkipped ? 1 : 0));

            reviews.Add(new SessionAnswerReview(
                q.Id,
                tq.OrderIndex,
                q.Part.ToString(),
                selectedId,
                correctOpt.Id,
                correctOpt.Label,
                isCorrect,
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation,
                // Transcript CHỈ ra ở đây — sau khi đã nộp bài. Không bao giờ ở
                // PlayQuestionItem (payload lúc đang thi), xem SessionAnswerReview.
                string.IsNullOrWhiteSpace(q.Transcript) ? null : q.Transcript
            ));
        }

        var listeningScore = ToeicScoreHelper.ConvertSectionScore(
            listeningCorrect, listeningTotal, ToeicScoredSection.Listening);
        var readingScore = ToeicScoreHelper.ConvertSectionScore(
            readingCorrect, readingTotal, ToeicScoredSection.Reading);
        int? totalScore = null;
        if (listeningScore.HasValue && readingScore.HasValue)
            totalScore = listeningScore + readingScore;
        else if (listeningScore.HasValue)
            totalScore = listeningScore;
        else if (readingScore.HasValue)
            totalScore = readingScore;

        var partBreakdown = PartBreakdownBuilder.Build(partStats);
        var completedAt = session.CompletedAt ?? session.StartedAt;

        // Đáp án lưu trong session — ưu tiên hơn scope đề hiện tại (đề có thể đã đổi câu)
        var fromSaved = await GradeFromSavedAnswersAsync(sessionId, session.TestId);
        var storedCorrect = session.CorrectCount ?? 0;

        var responseReviews = reviews;
        var responseBreakdown = partBreakdown;
        var responseCorrect = correctTotal;
        var responseSkipped = skippedTotal;
        var responseListening = listeningScore;
        var responseReading = readingScore;
        var responseTotal = totalScore;

        if (fromSaved.CorrectTotal > correctTotal)
        {
            // Map được đáp án thật trong DB — dùng breakdown/review từ đó
            responseReviews = fromSaved.Reviews;
            responseBreakdown = fromSaved.PartBreakdown;
            responseCorrect = fromSaved.CorrectTotal;
            responseSkipped = fromSaved.SkippedTotal;
            var savedScores = ComputeSectionScores(
                fromSaved.ListeningCorrect,
                fromSaved.ListeningTotal,
                fromSaved.ReadingCorrect,
                fromSaved.ReadingTotal);
            responseListening = savedScores.Listening;
            responseReading = savedScores.Reading;
            responseTotal = savedScores.Total;
        }
        else if (storedCorrect > correctTotal)
        {
            // Không map được đáp án — giữ điểm đã chấm lúc nộp, KHÔNG ghi đè DB
            responseCorrect = storedCorrect;
            responseSkipped = (session.TotalCount ?? scopeQuestions.Count) - storedCorrect;
            responseListening = session.ListeningScore;
            responseReading = session.ReadingScore;
            responseTotal = session.TotalScore;
        }

        return Result<TestSessionDetailResponse>.Success(new TestSessionDetailResponse(
            session.Id,
            test.Id,
            test.Title,
            test.Series,
            session.Status,
            session.StartedAt,
            completedAt,
            partsArr,
            responseCorrect,
            session.TotalCount ?? scopeQuestions.Count,
            responseSkipped,
            responseListening,
            responseReading,
            responseTotal,
            responseBreakdown,
            responseReviews
        ));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS — Best score / đề cho biểu đồ (Day 31 Bước 3)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestScoreStatsResponse>> GetScoreStatsByTestAsync(
        Guid userId,
        bool fullOnly = true)
    {
        var user = await _uow.Repository<ApplicationUser>().GetByIdAsync(userId);
        if (user is null)
            return Result<TestScoreStatsResponse>.NotFound("Không tìm thấy tài khoản.");

        var sessions = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId && s.Status == TestSessionStatus.Completed))
            .Where(s => !fullOnly || string.IsNullOrWhiteSpace(s.PartsFilter))
            .ToList();

        if (sessions.Count == 0)
            return Result<TestScoreStatsResponse>.Success(
                new TestScoreStatsResponse(user.TargetScore, Array.Empty<TestScoreByTestItem>()));

        var testIds = sessions.Select(s => s.TestId).Distinct().ToList();
        var tests = await _uow.Repository<Test>().FindAsync(t => testIds.Contains(t.Id));
        var testDict = tests.ToDictionary(t => t.Id);

        var items = sessions
            .GroupBy(s => s.TestId)
            .Select(g =>
            {
                testDict.TryGetValue(g.Key, out var test);
                var attempts = g.ToList();
                var withTotal = attempts.Where(s => s.TotalScore.HasValue).ToList();
                var best = withTotal.Count > 0
                    ? withTotal
                        .OrderByDescending(s => s.TotalScore)
                        .ThenByDescending(s => s.CompletedAt ?? s.StartedAt)
                        .First()
                    : null;

                return new TestScoreByTestItem(
                    g.Key,
                    test?.Title ?? string.Empty,
                    test?.Series ?? string.Empty,
                    attempts.Count,
                    best?.TotalScore,
                    best?.ListeningScore,
                    best?.ReadingScore,
                    best?.Id,
                    attempts.Max(s => s.CompletedAt ?? s.StartedAt)
                );
            })
            .OrderBy(i => i.TestSeries)
            .ThenBy(i => i.TestTitle)
            .ToList();

        return Result<TestScoreStatsResponse>.Success(
            new TestScoreStatsResponse(user.TargetScore, items));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS — Tổng quan dashboard (Day 32 Bước 1)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestStatsOverviewResponse>> GetStatsOverviewAsync(
        Guid userId,
        bool fullOnly = true)
    {
        var user = await _uow.Repository<ApplicationUser>().GetByIdAsync(userId);
        if (user is null)
            return Result<TestStatsOverviewResponse>.NotFound("Không tìm thấy tài khoản.");

        var sessions = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId && s.Status == TestSessionStatus.Completed))
            .Where(s => !fullOnly || string.IsNullOrWhiteSpace(s.PartsFilter))
            .ToList();

        if (sessions.Count == 0)
        {
            return Result<TestStatsOverviewResponse>.Success(
                new TestStatsOverviewResponse(
                    user.TargetScore,
                    0,
                    0,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null));
        }

        var withTotal = sessions.Where(s => s.TotalScore.HasValue).ToList();
        var distinctTests = sessions.Select(s => s.TestId).Distinct().Count();

        TestSession? best = null;
        if (withTotal.Count > 0)
        {
            best = withTotal
                .OrderByDescending(s => s.TotalScore)
                .ThenByDescending(s => s.CompletedAt ?? s.StartedAt)
                .First();
        }

        var latest = sessions
            .OrderByDescending(s => s.CompletedAt ?? s.StartedAt)
            .First();

        double? average = withTotal.Count > 0
            ? Math.Round(withTotal.Average(s => s.TotalScore!.Value), 1)
            : null;

        return Result<TestStatsOverviewResponse>.Success(
            new TestStatsOverviewResponse(
                user.TargetScore,
                sessions.Count,
                distinctTests,
                best?.TotalScore,
                best?.Id,
                latest.TotalScore,
                latest.Id,
                average,
                latest.CompletedAt ?? latest.StartedAt));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS — Timeline điểm theo thời gian (Day 32 Bước 2)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestStatsTimelineResponse>> GetStatsTimelineAsync(
        Guid userId,
        bool fullOnly = true)
    {
        var user = await _uow.Repository<ApplicationUser>().GetByIdAsync(userId);
        if (user is null)
            return Result<TestStatsTimelineResponse>.NotFound("Không tìm thấy tài khoản.");

        var sessions = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId && s.Status == TestSessionStatus.Completed))
            .Where(s => !fullOnly || string.IsNullOrWhiteSpace(s.PartsFilter))
            .OrderBy(s => s.CompletedAt ?? s.StartedAt)
            .ToList();

        if (sessions.Count == 0)
            return Result<TestStatsTimelineResponse>.Success(
                new TestStatsTimelineResponse(user.TargetScore, Array.Empty<TestStatsTimelineItem>()));

        var testIds = sessions.Select(s => s.TestId).Distinct().ToList();
        var tests = await _uow.Repository<Test>().FindAsync(t => testIds.Contains(t.Id));
        var testDict = tests.ToDictionary(t => t.Id);

        var items = sessions.Select(s =>
        {
            testDict.TryGetValue(s.TestId, out var test);
            return new TestStatsTimelineItem(
                s.Id,
                s.TestId,
                test?.Title ?? string.Empty,
                test?.Series ?? string.Empty,
                s.CompletedAt ?? s.StartedAt,
                ParsePartsFilter(s.PartsFilter),
                s.ListeningScore,
                s.ReadingScore,
                s.TotalScore);
        }).ToList();

        return Result<TestStatsTimelineResponse>.Success(
            new TestStatsTimelineResponse(user.TargetScore, items));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STATS — Gom Part yếu từ nhiều phiên (Day 32 Bước 3)
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestStatsPartsResponse>> GetStatsPartsAsync(
        Guid userId,
        bool fullOnly = true)
    {
        var sessions = (await _uow.Repository<TestSession>().FindAsync(s =>
                s.UserId == userId && s.Status == TestSessionStatus.Completed))
            .Where(s => !fullOnly || string.IsNullOrWhiteSpace(s.PartsFilter))
            .ToList();

        if (sessions.Count == 0)
        {
            return Result<TestStatsPartsResponse>.Success(
                new TestStatsPartsResponse(0, Array.Empty<PartBreakdownItem>(), Array.Empty<int>()));
        }

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var answerRows = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => sessionIds.Contains(a.SessionId))).ToList();

        if (answerRows.Count == 0)
        {
            return Result<TestStatsPartsResponse>.Success(
                new TestStatsPartsResponse(sessions.Count, Array.Empty<PartBreakdownItem>(), Array.Empty<int>()));
        }

        var qIds = answerRows.Select(a => a.QuestionId).Distinct().ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        var qDict = questions.ToDictionary(q => q.Id);

        var options = await _uow.Repository<QuestionOption>().FindAsync(o => qIds.Contains(o.QuestionId));
        var correctOptByQ = options
            .Where(o => o.IsCorrect)
            .GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.First().Id);

        var partStats = new Dictionary<int, (int Correct, int Total, int Skipped)>();

        foreach (var ans in answerRows)
        {
            if (!qDict.TryGetValue(ans.QuestionId, out var q)) continue;
            if (!correctOptByQ.TryGetValue(q.Id, out var correctOptId)) continue;

            var selectedId = ans.SelectedOptionId;
            var isSkipped = selectedId is null;
            var isCorrect = !isSkipped && selectedId == correctOptId;

            var partNum = (int)q.Part;
            if (!partStats.TryGetValue(partNum, out var ps))
                ps = (0, 0, 0);
            partStats[partNum] = (
                ps.Correct + (isCorrect ? 1 : 0),
                ps.Total + 1,
                ps.Skipped + (isSkipped ? 1 : 0));
        }

        var parts = PartBreakdownBuilder.Build(partStats);
        var weakestParts = ResolveWeakestParts(parts);

        return Result<TestStatsPartsResponse>.Success(
            new TestStatsPartsResponse(sessions.Count, parts, weakestParts));
    }

    /// <summary>Part accuracy thấp nhất — trả về tất cả Part hòa điểm.</summary>
    private static IReadOnlyList<int> ResolveWeakestParts(IReadOnlyList<PartBreakdownItem> parts)
    {
        if (parts.Count == 0) return Array.Empty<int>();

        var minAccuracy = parts.Min(p => p.AccuracyPercent);
        return parts
            .Where(p => p.AccuracyPercent == minAccuracy)
            .Select(p => p.Part)
            .OrderBy(p => p)
            .ToList();
    }
}
