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
        // Chỉ lấy câu IsPublished = true; limit mặc định 10.
        // Tạo PracticeSession ghi lại đã phát câu nào cho ai.
        Task<PracticeStartResponse> GetQuestionsAsync(
            Guid userId,
            QuestionPart? part,
            DifficultyLevel? difficulty,
            string? tag,
            int limit);

        Task<Result<PracticeResultResponse>> SubmitAsync(Guid userId, SubmitPracticeRequest req);

    }
}
