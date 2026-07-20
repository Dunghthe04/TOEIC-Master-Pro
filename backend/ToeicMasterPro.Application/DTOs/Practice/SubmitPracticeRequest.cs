using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ToeicMasterPro.Application.DTOs.Practice
{
    // 1 câu user chọn (SelectedOptionId = null → bỏ qua)
    public record PracticeAnswerItem(Guid QuestionId, Guid? SelectedOptionId);
    // Danh sách đáp án cả phiên luyện
    public record SubmitPracticeRequest(List<PracticeAnswerItem> Answers);
}
