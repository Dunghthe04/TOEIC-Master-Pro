using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Services;

public class TestService : ITestService
{
    private readonly IUnitOfWork _uow;
    private readonly ICurrentUserService _currentUser;

    public TestService(IUnitOfWork uow, ICurrentUserService currentUse)
    {
        _uow = uow;
        _currentUser = currentUse;
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
            t.Id, t.Title, t.Description, t.DurationMinutes,
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

}