using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToeicMasterPro.Application.DTOs.Practice
{
    // 1 câu user chọn (SelectedOptionId = null → bỏ qua)
    public record PracticeAnswerItem(Guid QuestionId, Guid? SelectedOptionId);

    /// <summary>
    /// Đáp án cả lượt luyện. SessionId BẮT BUỘC — nó là thứ chứng minh những câu này
    /// đã thật sự được phát cho chính user đang gọi.
    /// </summary>
    public record SubmitPracticeRequest(Guid SessionId, List<PracticeAnswerItem> Answers);

}
