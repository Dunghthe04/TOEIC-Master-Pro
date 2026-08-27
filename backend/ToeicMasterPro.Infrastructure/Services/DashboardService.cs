using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Dashboard;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services;

/// <inheritdoc />
public class DashboardService : IDashboardService
{
    private readonly IUnitOfWork _uow;

    public DashboardService(IUnitOfWork uow) => _uow = uow;

    /// <inheritdoc />
    public async Task<Result<TodayPlanResponse>> GetTodayPlanAsync(Guid userId)
    {
        var user = await _uow.Repository<ApplicationUser>().GetByIdAsync(userId);
        if (user is null) return Result<TodayPlanResponse>.NotFound("Không tìm thấy người dùng.");

        // ── Các phiên đã nộp ──
        var sessions = (await _uow.Repository<TestSession>()
                .FindAsync(s => s.UserId == userId && s.Status == TestSessionStatus.Completed))
            .ToList();

        // Điểm gần nhất CHỈ tính phiên FULL. Phiên chỉ làm Part 5 vẫn có TotalScore, nhưng
        // đem so với thang 990 là so sai — và đó là con số đứng cạnh mục tiêu, sai thì
        // người học hiểu sai mình đang ở đâu.
        var latestFull = sessions
            .Where(s => string.IsNullOrWhiteSpace(s.PartsFilter) && s.TotalScore.HasValue)
            .OrderByDescending(s => s.CompletedAt ?? s.StartedAt)
            .FirstOrDefault();

        // ── Câu sai: đọc từ SỔ TAY LỖI SAI ──
        //
        // 🔴 TRƯỚC ĐÂY TÍNH LẠI TỪ TestSessionAnswers, giờ không nữa. Bảng
        // UserQuestionReviews đã là nguồn duy nhất cho "câu tôi làm sai" — nó biết thêm
        // hai thứ mà bảng trả lời không biết: người học đã luyện lại đúng mấy lần, và đã
        // tự bấm "đã hiểu" chưa.
        //
        // Giữ hai nơi đếm theo hai cách thì chúng SẼ lệch nhau — người dùng gỡ một câu ở
        // sổ tay mà khối HÔM NAY vẫn đếm nó, và không ai biết con số nào đúng.
        var (wrongByPart, wrongTotal) = await CountFromNotebookAsync(userId);

        // Câu bỏ trống vẫn tính từ bảng trả lời: chúng KHÔNG vào sổ tay (xem chú thích ở
        // UserQuestionReview), nhưng vẫn cần hiện làm ghi chú để người dùng hiểu vì sao
        // con số "câu sai" nhỏ hơn nhiều so với số câu họ nhớ là mình bỏ trống.
        var skippedTotal = await CountSkippedAsync(sessions);

        // ── Thẻ từ đến hạn ──
        var today = DateTime.UtcNow.Date;
        var vocabDue = (await _uow.Repository<UserVocabulary>()
                .FindAsync(v => v.UserId == userId && !v.IsLearned && v.NextReviewDate <= today))
            .Count();

        // ── Đã thi tuần này chưa ──
        //
        // Tính theo TUẦN LỊCH (từ thứ Hai), không phải 7 ngày gần nhất. Lời nhắc "chưa thi
        // đề nào tuần này" chỉ có nghĩa khi nó khớp với cách người ta hiểu chữ "tuần" —
        // dùng cửa sổ trượt thì thứ Hai vừa thi, thứ Bảy vẫn báo "đã thi tuần này", còn thứ
        // Ba tuần sau lại báo chưa dù mới thi 2 hôm trước.
        // DayOfWeek đếm từ Chủ Nhật = 0, nên +6 rồi %7 để Thứ Hai thành 0.
        var monday = today.AddDays(-(((int)today.DayOfWeek + 6) % 7));
        var testedThisWeek = sessions.Any(s => (s.CompletedAt ?? s.StartedAt) >= monday);

        // ── Đề đề nghị thi tiếp ──
        var doneTestIds = sessions.Select(s => s.TestId).ToHashSet();
        var nextTest = (await _uow.Repository<Test>().FindAsync(t => t.IsPublished))
            .Where(t => !doneTestIds.Contains(t.Id))
            .OrderBy(t => t.CreatedAt)
            .FirstOrDefault();

        // ── Còn mấy tuần tới ngày thi ──
        //
        // Làm tròn LÊN: còn 3 ngày mà hiện "còn 0 tuần" thì đọc ra như đã hết hạn.
        int? weeksLeft = null;
        if (user.ExamDate is { } exam)
        {
            var days = (exam.Date - today).TotalDays;
            weeksLeft = days <= 0 ? 0 : (int)Math.Ceiling(days / 7);
        }

        return Result<TodayPlanResponse>.Success(new TodayPlanResponse(
            user.TargetScore,
            latestFull?.TotalScore,
            user.ExamDate,
            weeksLeft,
            wrongTotal,
            wrongByPart,
            skippedTotal,
            vocabDue,
            testedThisWeek,
            nextTest?.Id,
            nextTest?.Title));
    }

    /// <summary>
    /// Đếm câu chưa gỡ trong SỔ TAY LỖI SAI, kèm phân bố theo Part.
    ///
    /// Đọc thẳng bảng UserQuestionReviews thay vì tính lại từ lịch sử trả lời — bảng đó
    /// đã là nguồn duy nhất, và nó biết thêm việc người học đã gỡ câu nào.
    /// </summary>
    private async Task<(List<WrongByPartItem> ByPart, int Wrong)> CountFromNotebookAsync(Guid userId)
    {
        var rows = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && !r.IsResolved))
            .ToList();

        if (rows.Count == 0) return ([], 0);

        // Part nằm ở bảng Question, không có trong sổ tay — nạp thêm một lượt.
        //
        // KHÔNG nhân bản cột Part sang UserQuestionReviews cho tiện: Part của một câu là
        // thuộc tính của CÂU, không phải của lần học. Chép ra thì có hai bản, và bản chép
        // sẽ sai vào ngày ai đó sửa Part của câu gốc.
        var qIds = rows.Select(r => r.QuestionId).ToList();
        var questions = await _uow.Repository<Question>().FindAsync(q => qIds.Contains(q.Id));

        var byPart = questions
            .GroupBy(q => (int)q.Part)
            .Select(g => new WrongByPartItem(g.Key, g.Count()))
            .OrderBy(x => x.Part)
            .ToList();

        return (byPart, rows.Count);
    }

    /// <summary>
    /// Đếm câu BỎ TRỐNG ở lần làm gần nhất.
    ///
    /// Vẫn tính từ bảng trả lời chứ không từ sổ tay, vì câu bỏ trống cố ý KHÔNG vào sổ tay
    /// — xem chú thích ở <c>UserQuestionReview</c>. Con số này chỉ dùng làm ghi chú.
    /// </summary>
    private async Task<int> CountSkippedAsync(List<TestSession> sessions)
    {
        if (sessions.Count == 0) return 0;

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var answers = (await _uow.Repository<TestSessionAnswer>()
                .FindAsync(a => sessionIds.Contains(a.SessionId)))
            .ToList();

        if (answers.Count == 0) return 0;

        var sessionTime = sessions.ToDictionary(s => s.Id, s => s.CompletedAt ?? s.StartedAt);

        return answers
            .GroupBy(a => a.QuestionId)
            .Select(g => g.OrderByDescending(a => sessionTime.GetValueOrDefault(a.SessionId)).First())
            .Count(a => a.SelectedOptionId == null);
    }
}
