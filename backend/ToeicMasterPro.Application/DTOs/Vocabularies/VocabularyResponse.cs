using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Vocabularies
{
    // Trả về khi GET list / detail
    public record VocabularyResponse(
        Guid Id,
        string Word,
        string Phonetic,
        string Definition,      // nghĩa Việt
        string DefinitionEn,    // nghĩa Anh
        string? ExampleSentence,
        string? AudioUrl,
        VocabTopic Topic,       // Business=1, Finance=2, ...
        string WordType,        // noun, verb, adj...
        DateTime CreatedAt
    );
}
