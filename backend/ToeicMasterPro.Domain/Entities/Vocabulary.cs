using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Domain.Entities;

public class Vocabulary : BaseEntity
{
    public string Word { get; set; } = string.Empty;// từ vựng
    public string Phonetic { get; set; } = string.Empty;    // phiên âm
    public string Definition { get; set; } = string.Empty;  // định nghĩa tiếng việt
    public string DefinitionEn { get; set; } = string.Empty;// định nghĩa tiếng anh
    public string? ExampleSentence { get; set; } // câu ví dụ
    public string? AudioUrl { get; set; } // đường dẫn âm thanh
    public VocabTopic Topic { get; set; }
    public string WordType { get; set; } = string.Empty;    // noun, verb, adj...

    public ICollection<UserVocabulary> UserVocabularies { get; set; } = [];
}
