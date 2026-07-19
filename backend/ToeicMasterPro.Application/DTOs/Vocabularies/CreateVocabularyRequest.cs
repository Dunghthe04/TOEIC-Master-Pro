using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Vocabularies;

public record CreateVocabularyRequest(
    string Word,
    string Phonetic,
    string Definition,
    string DefinitionEn,
    string? ExampleSentence,
    string? AudioUrl,
    VocabTopic Topic,
    string WordType
);