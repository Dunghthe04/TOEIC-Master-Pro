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

    // ═══════════════════════════════════════════════════════════════════════
    // START — Bắt đầu phiên thi
    // ═══════════════════════════════════════════════════════════════════════

    /// <inheritdoc />
    public async Task<Result<TestSessionStartedResponse>> StartAsync(Guid userId, StartTestSessionRequest req)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(req.TestId);
        if (test is null || !test.IsPublished)
            return Result<TestSessionStartedResponse>.Failure("Không tìm thấy đề thi hoặc chưa publish.");

        // Chuẩn hóa parts: chỉ giữ số 1–7, bỏ trùng
        var partsArr = NormalizeParts(req.Parts);
        var partsFilterStr = partsArr is null ? null : string.Join(",", partsArr);

        // Đếm số câu trong phạm vi user chọn (giống GET /play)
        var questionCount = await CountQuestionsInScopeAsync(req.TestId, partsArr);
        if (questionCount == 0)
            return Result<TestSessionStartedResponse>.Failure("Đề không có câu hỏi phù hợp filter Part.");

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
            questionCount
        ));
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
        if (session is null)
            return Result<int>.Failure("Không tìm thấy phiên thi.");
        if (session.UserId != userId)
            return Result<int>.Failure("Phiên thi không thuộc tài khoản này.");
        if (session.Status != TestSessionStatus.InProgress)
            return Result<int>.Failure("Phiên thi đã kết thúc — không thể sửa đáp án.");

        // Tập QuestionId hợp lệ trong phạm vi session (đề + parts filter)
        var partsArr = ParsePartsFilter(session.PartsFilter);
        var allowedIds = await GetQuestionIdsInScopeAsync(session.TestId, partsArr);

        // Đáp án đã lưu trước đó — key = QuestionId
        var existing = (await _uow.Repository<TestSessionAnswer>()
            .FindAsync(a => a.SessionId == sessionId))
            .ToDictionary(a => a.QuestionId);

        var saved = 0;
        foreach (var item in req.Answers)
        {
            if (!allowedIds.Contains(item.QuestionId))
                return Result<int>.Failure($"Câu {item.QuestionId} không thuộc phạm vi phiên thi này.");

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
        if (session is null)
            return Result<TestSessionSubmitResponse>.Failure("Không tìm thấy phiên thi.");
        if (session.UserId != userId)
            return Result<TestSessionSubmitResponse>.Failure("Phiên thi không thuộc tài khoản này.");
        if (session.Status != TestSessionStatus.InProgress)
            return Result<TestSessionSubmitResponse>.Failure("Phiên thi đã được nộp trước đó.");

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
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation
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

        var completedAt = DateTime.UtcNow;
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
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation
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
        if (session is null)
            return Result<TestSessionDetailResponse>.Failure("Không tìm thấy phiên thi.");
        if (session.UserId != userId)
            return Result<TestSessionDetailResponse>.Failure("Phiên thi không thuộc tài khoản này.");
        if (session.Status != TestSessionStatus.Completed)
            return Result<TestSessionDetailResponse>.Failure("Chỉ xem được phiên đã nộp bài.");

        var test = await _uow.Repository<Test>().GetByIdAsync(session.TestId);
        if (test is null)
            return Result<TestSessionDetailResponse>.Failure("Không tìm thấy đề thi.");

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
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation
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
            return Result<TestScoreStatsResponse>.Failure("Không tìm thấy tài khoản.");

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
}
