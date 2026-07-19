using ToeicMasterPro.Application.DTOs.ExamSchedules;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IExamScheduleService
{
    // city/month/year/isActive = null → không lọc (Day 20 UI dùng)
    Task<IReadOnlyList<ExamScheduleResponse>> GetListAsync(
        string? city, int? month, int? year, bool? isActive);

    Task<Result<ExamScheduleResponse>> GetByIdAsync(Guid id);
    Task<Result<Guid>> CreateAsync(CreateExamScheduleRequest req);
    Task<Result> UpdateAsync(Guid id, UpdateExamScheduleRequest req);
    Task<Result> DeleteAsync(Guid id);
    Task<Result<(string FileName, string Content)>> GetIcalAsync(Guid id);

}
