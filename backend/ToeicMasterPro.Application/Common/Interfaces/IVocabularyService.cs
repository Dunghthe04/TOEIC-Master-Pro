using ToeicMasterPro.Application.DTOs.Vocabularies;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IVocabularyService
{
    // topic/search = null → không lọc
    Task<IReadOnlyList<VocabularyResponse>> GetListAsync(VocabTopic? topic, string? search);

    Task<Result<VocabularyResponse>> GetByIdAsync(Guid id);
    Task<Result<Guid>> CreateAsync(CreateVocabularyRequest req);
    Task<Result> UpdateAsync(Guid id, UpdateVocabularyRequest req);
    Task<Result> DeleteAsync(Guid id);
}