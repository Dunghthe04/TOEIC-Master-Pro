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

    // Import Excel — optional gắn đề + AudioFile/ImageFile
    Task<ImportResultResponse> ImportAsync(Stream fileStream, ImportQuestionOptions? options = null);

    /// <summary>File Excel mẫu cho CM (Part 1–4 Listening).</summary>
    Task<byte[]> GetImportTemplateAsync();
}
