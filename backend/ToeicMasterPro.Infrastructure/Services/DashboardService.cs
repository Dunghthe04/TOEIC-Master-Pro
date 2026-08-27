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

        // ── Câu sai: lấy theo lần làm GẦN NHẤT của từng câu ──
        //
        // Vì sao không đếm mọi lần sai: làm lại đề cũ và sửa được câu 104 thì câu đó KHÔNG
        // còn là lỗi sai nữa. Cộng dồn mọi lần sai thì sổ tay chỉ phình ra, không bao giờ
        // vơi đi — và một danh sách không bao giờ vơi thì không ai buồn mở.
        var (wrongByPart, wrongTotal, skippedTotal) = await CountMistakesAsync(sessions);

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
    /// Đếm câu sai / câu bỏ trống theo LẦN LÀM GẦN NHẤT của mỗi câu.
    ///
    /// Dùng thẳng cờ <c>TestSessionAnswer.IsCorrect</c> thay vì tính lại từ QuestionOptions:
    /// đã đối chiếu trên toàn bộ 2.300 dòng dữ liệu thật — 97 câu đúng, **0 câu lệch**. Cờ
    /// đó đáng tin, và tính lại thì phải nạp thêm hai bảng cho mỗi lần mở Dashboard.
    /// </summary>
    private async Task<(List<WrongByPartItem> ByPart, int Wrong, int Skipped)> CountMistakesAsync(
        List<TestSession> sessions)
    {
        if (sessions.Count == 0) return ([], 0, 0);

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var answers = (await _uow.Repository<TestSessionAnswer>()
                .FindAsync(a => sessionIds.Contains(a.SessionId)))
            .ToList();

        if (answers.Count == 0) return ([], 0, 0);

        // Thời điểm của từng phiên — để biết đâu là lần làm gần nhất của một câu.
        var sessionTime = sessions.ToDictionary(s => s.Id, s => s.CompletedAt ?? s.StartedAt);

        var latestPerQuestion = answers
            .GroupBy(a => a.QuestionId)
            .Select(g => g.OrderByDescending(a => sessionTime.GetValueOrDefault(a.SessionId)).First())
            .ToList();

        var wrongIds = latestPerQuestion
            .Where(a => a.SelectedOptionId != null && !a.IsCorrect)
            .Select(a => a.QuestionId)
            .ToList();

        var skipped = latestPerQuestion.Count(a => a.SelectedOptionId == null);

        if (wrongIds.Count == 0) return ([], 0, skipped);

        // Part nằm ở bảng Question, không có trong bảng trả lời — phải nạp thêm một lượt.
        var questions = await _uow.Repository<Question>().FindAsync(q => wrongIds.Contains(q.Id));

        var byPart = questions
            .GroupBy(q => (int)q.Part)
            .Select(g => new WrongByPartItem(g.Key, g.Count()))
            .OrderBy(x => x.Part)
            .ToList();

        return (byPart, wrongIds.Count, skipped);
    }
}
