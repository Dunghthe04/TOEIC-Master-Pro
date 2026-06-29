using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface ITestService
{
    Task<IReadOnlyList<TestSummaryResponse>> GetListAsync(bool? isPublished);
    Task<Result<TestDetailResponse>> GetByIdAsync(Guid id);
    Task<Result<Guid>> CreateAsync(CreateTestRequest req);
    Task<Result> UpdateAsync(Guid id, UpdateTestRequest req);
    Task<Result> DeleteAsync(Guid id);
    Task<Result> AddQuestionsAsync(Guid testId, AddQuestionsRequest req);
    Task<Result> RemoveQuestionAsync(Guid testId, Guid questionId);

}