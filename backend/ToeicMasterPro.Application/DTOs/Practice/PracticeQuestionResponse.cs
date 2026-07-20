using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.DTOs.Practice
{
    // Option lúc luyện — KHÔNG có IsCorrect
    public record PracticeOptionDto(Guid Id, string Label, string Content);

    // Câu hỏi lúc luyện — KHÔNG có Explanation / IsCorrect
    public record PracticeQuestionResponse(
        Guid Id,
        QuestionPart Part,
        DifficultyLevel Difficulty,
        string Content,
        string? AudioUrl,
        string? ImageUrl,
        string? Passage,
        string[] Tags,
        List<PracticeOptionDto> Options
    );
}
