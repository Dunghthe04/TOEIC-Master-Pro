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
    /// <summary>Import đề: thay câu tại cùng OrderIndex, giữ các câu khác.</summary>
    Task<Result> UpsertQuestionsByOrderAsync(Guid testId, AddQuestionsRequest req);
    Task<Result> RemoveQuestionAsync(Guid testId, Guid questionId);

    // Day 26: danh sách published + lọc series (null = tất cả)
    Task<IReadOnlyList<TestSummaryResponse>> GetPublishedListAsync(string? series);
    // Cấu trúc Part + số câu trong đề
    Task<Result<TestStructureResponse>> GetStructureAsync(Guid id);
    // Câu thi theo OrderIndex; parts=null → full; che đáp án
    Task<Result<TestPlayResponse>> GetPlayAsync(Guid id, int[]? parts);

    /// <summary>Gán hàng loạt câu Part 1–4 published chưa có trong đề.</summary>
    Task<Result<int>> AssignListeningQuestionsAsync(Guid testId);

}