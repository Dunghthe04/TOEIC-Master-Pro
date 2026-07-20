using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToeicMasterPro.Application.DTOs.Practice
{
    // Chi tiết từng câu sau khi nộp
    public record PracticeAnswerReview(
        Guid QuestionId,
        Guid? SelectedOptionId,
        Guid CorrectOptionId,
        string CorrectLabel,     // "A" / "B"...
        bool IsCorrect,
        string Explanation
    );
    public record PracticeResultResponse(
        int TotalCount,
        int CorrectCount,
        int SkippedCount,
        double ScorePercent,     // CorrectCount / TotalCount * 100
        List<PracticeAnswerReview> Reviews
    );
}
