using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IQuestionService
{
    Task<Result<Guid>> CreateAsync(CreateQuestionRequest req);
    Task<Result<QuestionResponse>> GetByIdAsync(Guid id);
    Task<IReadOnlyList<QuestionResponse>> GetListAsync(QuestionPart? part, DifficultyLevel? difficulty, bool? isPublished, string? tag);
    Task<Result> UpdateAsync(Guid id, UpdateQuestionRequest req);
    Task<Result> DeleteAsync(Guid id);
}
