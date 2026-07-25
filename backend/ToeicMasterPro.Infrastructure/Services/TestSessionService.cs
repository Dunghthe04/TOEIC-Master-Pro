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
            listeningCorrect, listeningTotal, ToeicScoreHelper.ListeningSectionQuestions);
        var readingScore = ToeicScoreHelper.ConvertSectionScore(
            readingCorrect, readingTotal, ToeicScoreHelper.ReadingSectionQuestions);
        int? totalScore = null;
        if (listeningScore.HasValue && readingScore.HasValue)
            totalScore = listeningScore + readingScore;
        else if (listeningScore.HasValue)
            totalScore = listeningScore;
        else if (readingScore.HasValue)
            totalScore = readingScore;

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
}
