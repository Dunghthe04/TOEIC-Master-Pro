using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Application.DTOs.Practice;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Application.Common.Interfaces
{
    public interface IPracticeService
    {
        // Chỉ lấy câu IsPublished = true; limit mặc định 10, trả về danh sách câu hỏi lúc luyện
        Task<IReadOnlyList<PracticeQuestionResponse>> GetQuestionsAsync(
            QuestionPart? part,
            DifficultyLevel? difficulty,
            string? tag,
            int limit);
        Task<Result<PracticeResultResponse>> SubmitAsync(SubmitPracticeRequest req);
    }
}
