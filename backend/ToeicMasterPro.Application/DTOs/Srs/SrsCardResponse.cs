using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Srs;

// Thẻ ôn: thông tin từ + trạng thái SRS
public record SrsCardResponse(
    Guid VocabularyId,
    string Word,
    string Phonetic,
    string Definition,
    string DefinitionEn,
    string? ExampleSentence,
    string? AudioUrl,
    VocabTopic Topic,
    string WordType,
    int RepetitionCount,
    float EaseFactor,
    int IntervalDays,
    DateTime NextReviewDate,
    bool IsLearned
);