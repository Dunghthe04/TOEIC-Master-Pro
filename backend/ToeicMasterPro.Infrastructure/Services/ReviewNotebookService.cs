using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Review;
using ToeicMasterPro.Application.DTOs.Tests;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Services;

/// <inheritdoc />
public class ReviewNotebookService : IReviewNotebookService
{
    /// <summary>Trần số câu lấy một lượt — chặn `?take=100000` làm sập trang.</summary>
    private const int MaxTake = 50;

    private readonly IUnitOfWork _uow;

    public ReviewNotebookService(IUnitOfWork uow) => _uow = uow;

    /// <inheritdoc />
    public async Task<Result<ReviewNotebookResponse>> GetAsync(
        Guid userId, int? part, Guid? testId, int skip, int take)
    {
        take = Math.Clamp(take, 1, MaxTake);
        skip = Math.Max(0, skip);

        var rows = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && !r.IsResolved))
            .ToList();

        if (rows.Count == 0)
            return Result<ReviewNotebookResponse>.Success(
                new ReviewNotebookResponse(0, [], [], 0, []));

        // Nạp câu hỏi của TOÀN BỘ sổ tay, không chỉ trang hiện tại — cần Part của mọi câu
        // để dựng thanh lọc. Sổ tay vài trăm câu là cùng, một lượt nạp là chấp nhận được.
        var allIds = rows.Select(r => r.QuestionId).ToList();
        var questions = (await _uow.Repository<Question>().FindAsync(q => allIds.Contains(q.Id)))
            .ToDictionary(q => q.Id);

        // ─── Câu này thuộc đề nào, là câu số mấy ───
        // Sổ tay trộn câu sai của mọi đề. Thiếu hai thông tin này thì các bài đọc Part 7
        // nhìn na ná nhau và người học phải cuộn từng cái để tìm lại đề vừa thi.
        //
        // TestQuestion là quan hệ nhiều-nhiều nên về lý một câu nằm được ở nhiều đề. Thực
        // tế mỗi câu chỉ thuộc một đề (import tạo câu riêng cho từng đề), nên lấy bản ghi
        // có OrderIndex nhỏ nhất cho ổn định — KHÔNG phải cứ chạy lại là ra đề khác.
        var links = (await _uow.Repository<TestQuestion>()
                .FindAsync(tq => allIds.Contains(tq.QuestionId)))
            .GroupBy(tq => tq.QuestionId)
            .ToDictionary(g => g.Key, g => g.OrderBy(tq => tq.OrderIndex).First());

        var testIds = links.Values.Select(l => l.TestId).Distinct().ToList();
        var testTitles = (await _uow.Repository<Test>().FindAsync(t => testIds.Contains(t.Id)))
            .ToDictionary(t => t.Id, t => t.Title);

        var byPart = rows
            .Where(r => questions.ContainsKey(r.QuestionId))
            .GroupBy(r => (int)questions[r.QuestionId].Part)
            .Select(g => new ReviewPartCount(g.Key, g.Count()))
            .OrderBy(x => x.Part)
            .ToList();

        var byTest = rows
            .Where(r => links.ContainsKey(r.QuestionId))
            .GroupBy(r => links[r.QuestionId].TestId)
            .Select(g => new
            {
                TestId = g.Key,
                Title = testTitles.GetValueOrDefault(g.Key) ?? "Đề không rõ",
                Count = g.Count(),
                // Đề vừa thi xong là đề người học nhớ rõ nhất và muốn xem lại trước tiên.
                LastWrongAt = g.Max(r => r.LastWrongAt),
            })
            .OrderByDescending(x => x.LastWrongAt)
            .Select(x => new ReviewTestCount(x.TestId, x.Title, x.Count))
            .ToList();

        // Thứ tự các đề, để xếp câu bên dưới bám theo — cùng một danh sách nên thanh lọc
        // và danh sách câu không bao giờ nói hai thứ tự khác nhau.
        var testRank = byTest
            .Select((t, i) => (t.TestId, i))
            .ToDictionary(x => x.TestId, x => x.i);

        // Lọc SAU khi đếm: thanh lọc phải luôn hiện đủ mọi Part và mọi đề, nếu không thì
        // lọc sang Part 5 rồi là không có đường quay lại các Part khác.
        var filtered = rows
            .Where(r => questions.ContainsKey(r.QuestionId))
            .Where(r => part is null || (int)questions[r.QuestionId].Part == part)
            .Where(r => testId is null
                || (links.TryGetValue(r.QuestionId, out var l) && l.TestId == testId))
            // ─── Xếp theo ĐỀ trước, rồi theo SỐ CÂU ───
            //
            // Trước đây xếp "sai nhiều lần lên trước". Đúng về mặt ưu tiên học tập, nhưng
            // nó TRỘN các đề vào nhau: câu 147 đề 3 nằm cạnh câu 172 đề 1, và người học
            // báo là "tìm khá lâu". Một sổ tay chép theo đúng thứ tự đề thi thì dò được
            // bằng mắt; xếp theo mức độ sai thì phải đọc từng câu mới biết mình đang ở đâu.
            //
            // Câu sai nhiều lần không mất ưu tiên — nó vẫn được đánh dấu đỏ "sai N lần"
            // ngay trên thẻ, và đề mới thi nhất vẫn nằm trên cùng.
            .OrderBy(r => links.TryGetValue(r.QuestionId, out var lk)
                ? testRank.GetValueOrDefault(lk.TestId, int.MaxValue)
                : int.MaxValue)
            .ThenBy(r => links.TryGetValue(r.QuestionId, out var l2) ? l2.OrderIndex : int.MaxValue)
            .ToList();

        var page = filtered.Skip(skip).Take(take).ToList();
        if (page.Count == 0)
            return Result<ReviewNotebookResponse>.Success(
                new ReviewNotebookResponse(rows.Count, byPart, byTest, filtered.Count, []));

        // Phương án CHỈ nạp cho trang hiện tại — đây mới là phần nặng (4 dòng mỗi câu).
        var pageIds = page.Select(r => r.QuestionId).ToList();
        var options = (await _uow.Repository<QuestionOption>()
                .FindAsync(o => pageIds.Contains(o.QuestionId)))
            .GroupBy(o => o.QuestionId)
            .ToDictionary(g => g.Key, g => g.OrderBy(o => o.Label).ToList());

        var items = new List<ReviewQuestionItem>();

        foreach (var r in page)
        {
            var q = questions[r.QuestionId];
            var opts = options.GetValueOrDefault(q.Id) ?? [];
            var correct = opts.FirstOrDefault(o => o.IsCorrect);

            // Câu mất đáp án đúng thì BỎ QUA, không trả về nửa vời. Hiện một câu không có
            // đáp án ở màn học lại là bắt người dùng tự đoán — tệ hơn là không hiện.
            if (correct is null) continue;

            var link = links.GetValueOrDefault(r.QuestionId);

            items.Add(new ReviewQuestionItem(
                q.Id,
                link?.TestId,
                link is null ? null : testTitles.GetValueOrDefault(link.TestId) ?? "Đề không rõ",
                link?.OrderIndex,
                q.Part,
                q.Content,
                q.AudioUrl,
                q.ImageUrl,
                q.Passage,
                opts.Select(o => new PlayOptionItem(o.Id, o.Label, o.Content)).ToList(),
                correct.Id,
                string.IsNullOrWhiteSpace(q.Explanation) ? null : q.Explanation,
                string.IsNullOrWhiteSpace(q.Transcript) ? null : q.Transcript,
                r.WrongCount,
                r.CorrectStreak,
                r.LastWrongAt));
        }

        return Result<ReviewNotebookResponse>.Success(
            new ReviewNotebookResponse(rows.Count, byPart, byTest, filtered.Count, items));
    }

    /// <inheritdoc />
    public async Task<Result<AnswerReviewResponse>> AnswerAsync(
        Guid userId, Guid questionId, Guid selectedOptionId)
    {
        var row = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && r.QuestionId == questionId))
            .FirstOrDefault();

        if (row is null)
            return Result<AnswerReviewResponse>.NotFound("Câu này không có trong sổ tay của bạn.");

        var options = (await _uow.Repository<QuestionOption>()
                .FindAsync(o => o.QuestionId == questionId))
            .ToList();

        var correct = options.FirstOrDefault(o => o.IsCorrect);
        if (correct is null)
            return Result<AnswerReviewResponse>.Failure("Câu này chưa có đáp án đúng trong kho.");

        // Phương án gửi lên phải THUỘC câu này. Không kiểm thì gửi id của một phương án
        // thuộc câu khác sẽ luôn ra "sai" — và người học không hiểu vì sao.
        if (options.All(o => o.Id != selectedOptionId))
            return Result<AnswerReviewResponse>.Failure("Phương án không thuộc câu này.");

        var isCorrect = selectedOptionId == correct.Id;

        // Cùng luật với khi làm bài thi thật, và dùng CHUNG một đoạn mã trên entity —
        // không phải "viết lại cho giống". Xem chú thích ở UserQuestionReview.
        if (isCorrect) row.RecordCorrect();
        else row.RecordWrong(DateTime.UtcNow);

        _uow.Repository<UserQuestionReview>().Update(row);
        await _uow.SaveChangesAsync();

        var remaining = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && !r.IsResolved))
            .Count();

        return Result<AnswerReviewResponse>.Success(new AnswerReviewResponse(
            isCorrect, correct.Id, row.CorrectStreak, row.IsResolved, remaining));
    }

    /// <inheritdoc />
    public async Task<Result<int>> ResolveAsync(Guid userId, Guid questionId)
    {
        var row = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && r.QuestionId == questionId))
            .FirstOrDefault();

        if (row is null) return Result<int>.NotFound("Câu này không có trong sổ tay của bạn.");

        row.MarkUnderstood();
        _uow.Repository<UserQuestionReview>().Update(row);
        await _uow.SaveChangesAsync();

        var remaining = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && !r.IsResolved))
            .Count();

        return Result<int>.Success(remaining);
    }
}
