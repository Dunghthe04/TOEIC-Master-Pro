using Microsoft.Extensions.Options;
using System.IO;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.Common.Options;
using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services;

public class TestService : ITestService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;
    private readonly ToeicDirectionsOptions _directions;

    public TestService(
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        IOptions<ToeicDirectionsOptions> directions)
    {
        _uow = uow;
        _currentUser = currentUser;
        _directions = directions.Value;
    }

    public async Task<IReadOnlyList<TestSummaryResponse>> GetListAsync(bool? isPublished)
    {
        var tests = await _uow.Repository<Test>().FindAsync(t => isPublished == null || t.IsPublished == isPublished);

        //Lấy danh sách id của bài test
        var testIds = tests.Select(t => t.Id).ToList();
        //Lấy tất cả TestQuestion tương ứng
        var allTq = await _uow.Repository<TestQuestion>().FindAsync(tq => testIds.Contains(tq.TestId));
        //Đếm số câu hỏi ứng với mỗi bài test
        var countByTest = allTq.GroupBy(tq => tq.TestId)
            .ToDictionary(g => g.Key, g => g.Count());
        return tests.Select(t => new TestSummaryResponse(
            t.Id, t.Title, t.Series, t.Description, t.DurationMinutes,
            t.IsPublished, countByTest.GetValueOrDefault(t.Id, 0),
            t.CreatedByUserId, t.CreatedAt
        )).ToList();
    }

    public async Task<Result<TestDetailResponse>> GetByIdAsync(Guid id)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test == null)
        {
            return Result<TestDetailResponse>.Failure("Không tìm thấy đề thi!");
        }

        //lấy ra question của test
        var testQuestions = await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == id);
        //Trả về mảng id question
        var questionIds = testQuestions.Select(tq => tq.QuestionId).ToList();

        //lấy chi tiết câu hỏi
        var questions = await _uow.Repository<Question>().FindAsync(q => questionIds.Contains(q.Id));

        //Gom Dict để truy xuất nhanh theo id
        var questionDict = questions.ToDictionary(q => q.Id);

        //sap xep thu tu cau hoi
        var items = testQuestions
            .OrderBy(tq => tq.OrderIndex)
            .Where(tq => questionDict.ContainsKey(tq.QuestionId))
            .Select(tq => new TestQuestionItem(
                tq.QuestionId,
                tq.OrderIndex,
                questionDict[tq.QuestionId].Content,
                questionDict[tq.QuestionId].Part.ToString(),
                questionDict[tq.QuestionId].AudioUrl,
                questionDict[tq.QuestionId].ImageUrl
            )).ToList();

        return Result<TestDetailResponse>.Success(new TestDetailResponse(
            test.Id, test.Title, test.Series, test.Description, test.DurationMinutes,
            test.IsPublished, test.CreatedByUserId, test.CreatedAt, items
        ));

    }
    public async Task<Result<Guid>> CreateAsync(CreateTestRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return Result<Guid>.Failure("Tiêu đề đề thi không được trống.");

        if (_currentUser.UserId is null)
            return Result<Guid>.Failure("Không xác định được người dùng.");

        var userId = _currentUser.UserId.Value;

        var test = new Test
        {
            Title = req.Title,
            Series = req.Series?.Trim() ?? "",
            Description = req.Description,
            DurationMinutes = req.DurationMinutes,
            IsPublished = req.IsPublished,
            CreatedByUserId = userId
        };

        await _uow.Repository<Test>().AddAsync(test);
        await _uow.SaveChangesAsync();
        return Result<Guid>.Success(test.Id);
    }
    public async Task<Result> UpdateAsync(Guid id, UpdateTestRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
            return Result.Failure("Tiêu đề đề thi không được trống.");

        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test is null) return Result.Failure("Không tìm thấy đề thi.");

        test.Title = req.Title;
        test.Series = req.Series?.Trim() ?? "";
        test.Description = req.Description;
        test.DurationMinutes = req.DurationMinutes;
        test.IsPublished = req.IsPublished;

        _uow.Repository<Test>().Update(test);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }
    public async Task<Result> DeleteAsync(Guid id)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test is null) return Result.Failure("Không tìm thấy đề thi.");

        // Không xóa đề nếu đã có lịch sử thi — FK TestSessions.TestId (Restrict)
        var sessions = await _uow.Repository<TestSession>().FindAsync(s => s.TestId == id);
        var sessionCount = sessions.Count;
        if (sessionCount > 0)
        {
            return Result.Failure(
                $"Không thể xóa đề \"{test.Title}\" vì đã có {sessionCount} lượt thi được ghi nhận. " +
                "Hãy chuyển sang nháp (bỏ xuất bản) để user không thấy đề này nữa.");
        }

        _uow.Repository<Test>().Remove(test); // cascade xóa TestQuestion theo
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> AddQuestionsAsync(Guid testId, AddQuestionsRequest req)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(testId);
        if (test is null) return Result.Failure("Không tìm thấy đề thi.");

        // Lấy các câu đã có trong đề để tránh trùng
        var existing = await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == testId);
        var existingIds = existing.Select(tq => tq.QuestionId).ToHashSet();

        var toAdd = req.Items
            .Where(item => !existingIds.Contains(item.QuestionId))
            .Select(item => new TestQuestion
            {
                TestId = testId,
                QuestionId = item.QuestionId,
                OrderIndex = item.OrderIndex
            }).ToList();

        if (toAdd.Count == 0)
            return Result.Failure("Tất cả câu hỏi đã tồn tại trong đề thi.");

        foreach (var tq in toAdd)
            await _uow.Repository<TestQuestion>().AddAsync(tq);

        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    /// <summary>
    /// Gán (hoặc thay thế) câu hỏi vào đề theo OrderIndex — dùng sau import-listening.
    ///
    /// Bảng TestQuestion là bảng nối (many-to-many) giữa Test và Question:
    ///   TestId      → đề nào
    ///   QuestionId  → câu hỏi nào
    ///   OrderIndex  → câu đó đứng ở vị trí mấy trong đề (1–100 theo chuẩn TOEIC)
    ///
    /// Upsert = Update + Insert:
    ///   - Vị trí OrderIndex chưa có câu → thêm mới
    ///   - Vị trí OrderIndex đã có câu   → xóa câu cũ, gán câu mới (import lại không bị trùng)
    ///
    /// Khác AddQuestionsAsync: hàm kia chỉ thêm, bỏ qua nếu QuestionId đã có trong đề.
    /// Hàm này thay theo vị trí (OrderIndex), phù hợp khi CM import lại file Excel.
    /// </summary>
    public async Task<Result> UpsertQuestionsByOrderAsync(Guid testId, AddQuestionsRequest req)
    {
        // ── Bước 0: Kiểm tra đề thi tồn tại ──────────────────────────────────
        // testId đến từ URL /api/test/{id}/import-listening hoặc AssignImportedToTestAsync
        var test = await _uow.Repository<Test>().GetByIdAsync(testId);
        if (test is null) return Result.Failure("Không tìm thấy đề thi.");

        // ── Bước 1: Lấy danh sách câu ĐÃ gán trong đề này ───────────────────
        // Ví dụ đề đã có: OrderIndex 7 → QuestionId AAA, OrderIndex 8 → QuestionId BBB
        var existing = (await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == testId)).ToList();

        // Lấy tập OrderIndex mà lần import này muốn ghi đè
        // req.Items = [{ QuestionId: CCC, OrderIndex: 7 }, { QuestionId: DDD, OrderIndex: 8 }, ...]
        // → ordersToReplace = { 7, 8, ... }
        var ordersToReplace = req.Items.Select(i => i.OrderIndex).ToHashSet();

        // ── Bước 2: Xóa liên kết cũ ở các vị trí sẽ được thay thế ───────────
        // Chỉ Remove bản ghi TestQuestion (liên kết), KHÔNG xóa Question gốc trong bảng Questions
        // Ví dụ: đề có câu AAA ở vị trí 7, import gửi câu CCC vào vị trí 7
        //   → xóa dòng { TestId, QuestionId: AAA, OrderIndex: 7 }
        //   → sau đó thêm dòng { TestId, QuestionId: CCC, OrderIndex: 7 }
        foreach (var tq in existing.Where(tq => ordersToReplace.Contains(tq.OrderIndex)))
            _uow.Repository<TestQuestion>().Remove(tq);

        // ── Bước 3: Thêm liên kết mới cho từng câu vừa import ───────────────
        // Mỗi item = 1 dòng Excel đã tạo Question thành công + OrderIndex tương ứng
        foreach (var item in req.Items)
        {
            await _uow.Repository<TestQuestion>().AddAsync(new TestQuestion
            {
                TestId = testId,              // gán vào đề nào
                QuestionId = item.QuestionId, // câu hỏi vừa tạo từ ImportAsync
                OrderIndex = item.OrderIndex    // vị trí trong đề: 1, 7, 38, 71...
            });
        }

        // ── Bước 4: Ghi tất cả thay đổi (xóa + thêm) xuống DB một lần ───────
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> RemoveQuestionAsync(Guid testId, Guid questionId)
    {
        var tq = (await _uow.Repository<TestQuestion>()
            .FindAsync(tq => tq.TestId == testId && tq.QuestionId == questionId))
            .FirstOrDefault();

        if (tq is null) return Result.Failure("Câu hỏi không tồn tại trong đề thi này.");

        _uow.Repository<TestQuestion>().Remove(tq);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    /*   
   Người dùng vào danh sách đề
           ↓
   GetPublishedListAsync()
           ↓
   Chọn một đề
           ↓
   GetStructureAsync(id)
           ↓
   Xem cấu trúc đề
           ↓
   Bấm bắt đầu làm bài
           ↓
   GetPlayAsync(id, parts)
           ↓
   Lấy câu hỏi + đáp án + audio + image*/

    //Lấy danh sách các đề thi đã publish
    public async Task<IReadOnlyList<TestSummaryResponse>> GetPublishedListAsync(string? series)
    {
        var seriesNorm = string.IsNullOrWhiteSpace(series) ? null : series.Trim();
        var tests = await _uow.Repository<Test>().FindAsync(t =>
            t.IsPublished &&
            (seriesNorm == null || t.Series == seriesNorm));
        var testIds = tests.Select(t => t.Id).ToList();
        var allTq = await _uow.Repository<TestQuestion>()
            .FindAsync(tq => testIds.Contains(tq.TestId));
        var countByTest = allTq.GroupBy(tq => tq.TestId)
            .ToDictionary(g => g.Key, g => g.Count());
        return tests
            .OrderBy(t => t.Series).ThenBy(t => t.Title)
            .Select(t => new TestSummaryResponse(
                t.Id, t.Title, t.Series, t.Description, t.DurationMinutes,
                t.IsPublished, countByTest.GetValueOrDefault(t.Id, 0),
                t.CreatedByUserId, t.CreatedAt
            )).ToList();
    }
    //Lấy cấu trúc đề: có Part nào, mỗi Part bao nhiêu câu
    public async Task<Result<TestStructureResponse>> GetStructureAsync(Guid id)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test is null || !test.IsPublished)
            return Result<TestStructureResponse>.Failure("Không tìm thấy đề thi hoặc chưa publish.");
        var tqs = await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == id);
        var qIds = tqs.Select(tq => tq.QuestionId).ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        var qDict = questions.ToDictionary(q => q.Id);
        var parts = tqs
            .Where(tq => qDict.ContainsKey(tq.QuestionId))
            .GroupBy(tq => qDict[tq.QuestionId].Part)
            .OrderBy(g => (int)g.Key)
            .Select(g => new PartStructureItem(
                g.Key,
                $"PART {(int)g.Key}",
                g.Count()
            )).ToList();
        return Result<TestStructureResponse>.Success(new TestStructureResponse(
            test.Id, test.Title, test.Series, test.DurationMinutes,
            parts, tqs.Count
        ));
    }

    //Lấy toàn bộ dữ liệu để làm bài: câu hỏi, đáp án, audio, image...
    public async Task<Result<TestPlayResponse>> GetPlayAsync(Guid id, int[]? parts)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test is null || !test.IsPublished)
            return Result<TestPlayResponse>.Failure("Không tìm thấy đề thi hoặc chưa publish.");
        //Lấy ra các test question của đề 
        var tqs = (await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == id))
            .OrderBy(tq => tq.OrderIndex)
            .ToList();
        //Lấy ra id của test question
        var qIds = tqs.Select(tq => tq.QuestionId).ToList();
        //Lấy ra các câu hỏi có id in mảng test question id
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        //Tạo dic truy cập cho dễ dựa trên id của question
        var qDict = questions.ToDictionary(q => q.Id);
        //Lấy ra tất cả option của questions
        var options = await _uow.Repository<QuestionOption>()
            .FindAsync(o => qIds.Contains(o.QuestionId));
        //Nhóm option theo questionId, sắp xếp theo Label (A, B, C, D) và tạo dic để truy xuất nhanh
        var optByQ = options.GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.OrderBy(o => o.Label).ToList());
        // parts null/rỗng = full test; ngược lại lọc theo enum int (1..7)
        HashSet<QuestionPart>? partFilter = null;
        if (parts is { Length: > 0 })
            partFilter = parts.Select(p => (QuestionPart)p).ToHashSet();
        //Danh sách câu hỏi để trả về cho người dùng làm bài
        var playQuestions = new List<PlayQuestionItem>();
        //duyệt từng test question, lấy ra question + option tương ứng, tạo PlayQuestionItem
        foreach (var tq in tqs)
        {
            //nếu questionId không tồn tại trong qDict (câu hỏi đã bị xóa) → bỏ qua
            if (!qDict.TryGetValue(tq.QuestionId, out var q)) continue;
            if (partFilter is not null && !partFilter.Contains(q.Part)) continue;
            // Lấy option của câu hỏi này, tạo PlayOptionItem
            var opts = optByQ.GetValueOrDefault(q.Id, [])
                .Select(o => new PlayOptionItem(o.Id, o.Label, o.Content))
                .ToList();
            playQuestions.Add(new PlayQuestionItem(
                q.Id, tq.OrderIndex, q.Part, q.Content,
                q.AudioUrl, q.ImageUrl, q.Passage, opts
            ));
        }
        if (playQuestions.Count == 0)
            return Result<TestPlayResponse>.Failure("Đề không có câu hỏi phù hợp filter Part.");
        // Directions chỉ cho các Part có trong gói play
        var usedParts = playQuestions.Select(q => q.Part).Distinct().OrderBy(p => (int)p);
        // Tạo danh sách PlayPartDirections để trả về cho client hiển thị intro + audio theo Part
        var dirs = new List<PlayPartDirections>();
        foreach (var part in usedParts)
        {
            var key = ((int)part).ToString();
            if (_directions.Parts.TryGetValue(key, out var cfg))
                dirs.Add(new PlayPartDirections(part, cfg.ImageUrl, cfg.AudioUrl));
            else
                dirs.Add(new PlayPartDirections(part, $"/exam/directions/part{(int)part}.png", null));
        }
        return Result<TestPlayResponse>.Success(new TestPlayResponse(
            test.Id, test.Title, test.Series, test.DurationMinutes,
            dirs, playQuestions
        ));
    }

    /// <summary>
    /// Gán nhanh tất cả câu Listening (Part 1–4) published vào đề — nút tiện ích cho CM.
    ///
    /// Gọi từ: POST /api/test/{id}/assign-listening
    ///
    /// Khác import-listening / UpsertQuestionsByOrderAsync:
    ///   - Không đọc Excel, không dùng OrderIndex chuẩn TOEIC (1–100)
    ///   - Lấy mọi câu Part 1–4 published chưa có trong đề
    ///   - Gán OrderIndex nối tiếp sau vị trí cao nhất hiện có (maxOrder + 1, +2, ...)
    ///   - Sắp xếp: Part 1 → 2 → 3 → 4, trong mỗi Part theo CreatedAt (cũ trước)
    ///
    /// Dùng khi: CM đã import câu vào kho chung, muốn gán hàng loạt vào đề nhanh
    /// mà chưa có file Excel với OrderIndex chuẩn.
    /// </summary>
    /// <returns>Số câu đã gán thành công (ordered.Count).</returns>
    public async Task<Result<int>> AssignListeningQuestionsAsync(Guid testId)
    {
        // ── Bước 0: Kiểm tra đề thi tồn tại ──────────────────────────────────
        var test = await _uow.Repository<Test>().GetByIdAsync(testId);
        if (test is null) return Result<int>.Failure("Không tìm thấy đề thi.");

        // ── Bước 1: Xem đề đã có những câu nào ─────────────────────────────
        // existing = tất cả dòng TestQuestion của đề này
        var existing = await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == testId);

        // existingIds = tập QuestionId đã gán → tránh gán trùng cùng 1 câu 2 lần
        // (DB có unique constraint TestId + QuestionId)
        var existingIds = existing.Select(tq => tq.QuestionId).ToHashSet();

        // maxOrder = OrderIndex lớn nhất hiện tại trong đề
        // Ví dụ đề đã có câu ở vị trí 1, 5, 10 → maxOrder = 10
        // Câu mới sẽ bắt đầu từ 11, 12, 13... (nối tiếp, không ghi đè vị trí cũ)
        var maxOrder = existing.Any() ? existing.Max(tq => tq.OrderIndex) : 0;

        // ── Bước 2: Tìm câu Listening eligible để gán ──────────────────────
        var listeningParts = new[] { QuestionPart.Part1, QuestionPart.Part2, QuestionPart.Part3, QuestionPart.Part4 };

        // candidates = câu thỏa CẢ 3 điều kiện:
        //   1. IsPublished = true     → chỉ câu đã publish, user mới thấy khi thi
        //   2. Part thuộc 1, 2, 3, 4 → chỉ Listening (không lấy Reading Part 5–7)
        //   3. Id chưa nằm trong existingIds → chưa có trong đề này
        var candidates = await _uow.Repository<Question>().FindAsync(q =>
            q.IsPublished && listeningParts.Contains(q.Part) && !existingIds.Contains(q.Id));

        // Sắp xếp trước khi gán:
        //   - Part 1 trước, rồi 2, 3, 4 (theo thứ tự thi TOEIC)
        //   - Trong cùng Part: câu tạo sớm hơn (CreatedAt) đứng trước
        var ordered = candidates
            .OrderBy(q => (int)q.Part)
            .ThenBy(q => q.CreatedAt)
            .ToList();

        if (ordered.Count == 0)
            return Result<int>.Failure("Không có câu Listening published nào để gán.");

        // ── Bước 3: Gán từng câu — OrderIndex tăng dần từ maxOrder + 1 ─────
        var order = maxOrder;
        foreach (var q in ordered)
        {
            order++; // vị trí tiếp theo: 11, 12, 13... (không dùng 1–100 chuẩn TOEIC)
            await _uow.Repository<TestQuestion>().AddAsync(new TestQuestion
            {
                TestId = testId,
                QuestionId = q.Id,
                OrderIndex = order
            });
        }

        // ── Bước 4: Lưu DB, trả về số câu đã gán ────────────────────────────
        await _uow.SaveChangesAsync();
        return Result<int>.Success(ordered.Count);
    }

}