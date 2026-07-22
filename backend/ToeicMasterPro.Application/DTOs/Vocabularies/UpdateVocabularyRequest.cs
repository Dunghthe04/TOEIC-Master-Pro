using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Vocabularies;

// Giống Create — CM gửi full body khi sửa
public record UpdateVocabularyRequest(
	string Word,
	string Phonetic,
	string Definition,
	string DefinitionEn,
	string? ExampleSentence,
	string? AudioUrl,
	VocabTopic Topic,
	string WordType
);