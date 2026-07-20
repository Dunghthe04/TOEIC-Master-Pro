using Microsoft.Extensions.Options;
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
                questionDict[tq.QuestionId].Part.ToString()
            )).ToList();

        return Result<TestDetailResponse>.Success(new TestDetailResponse(
            test.Id, test.Title, test.Description, test.DurationMinutes,
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
    public async Task<Result<TestPlayResponse>> GetPlayAsync(Guid id, int[]? parts)
    {
        var test = await _uow.Repository<Test>().GetByIdAsync(id);
        if (test is null || !test.IsPublished)
            return Result<TestPlayResponse>.Failure("Không tìm thấy đề thi hoặc chưa publish.");
        var tqs = (await _uow.Repository<TestQuestion>().FindAsync(tq => tq.TestId == id))
            .OrderBy(tq => tq.OrderIndex)
            .ToList();
        var qIds = tqs.Select(tq => tq.QuestionId).ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));
        var qDict = questions.ToDictionary(q => q.Id);
        var options = await _uow.Repository<QuestionOption>()
            .FindAsync(o => qIds.Contains(o.QuestionId));
        var optByQ = options.GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.OrderBy(o => o.Label).ToList());
        // parts null/rỗng = full test; ngược lại lọc theo enum int (1..7)
        HashSet<QuestionPart>? partFilter = null;
        if (parts is { Length: > 0 })
            partFilter = parts.Select(p => (QuestionPart)p).ToHashSet();
        var playQuestions = new List<PlayQuestionItem>();
        foreach (var tq in tqs)
        {
            if (!qDict.TryGetValue(tq.QuestionId, out var q)) continue;
            if (partFilter is not null && !partFilter.Contains(q.Part)) continue;
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

}