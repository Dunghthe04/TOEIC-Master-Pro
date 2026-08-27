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
        Guid userId, int? part, int skip, int take)
    {
        take = Math.Clamp(take, 1, MaxTake);
        skip = Math.Max(0, skip);

        var rows = (await _uow.Repository<UserQuestionReview>()
                .FindAsync(r => r.UserId == userId && !r.IsResolved))
            .ToList();

        if (rows.Count == 0)
            return Result<ReviewNotebookResponse>.Success(new ReviewNotebookResponse(0, [], []));

        // Nạp câu hỏi của TOÀN BỘ sổ tay, không chỉ trang hiện tại — cần Part của mọi câu
        // để dựng thanh lọc. Sổ tay vài trăm câu là cùng, một lượt nạp là chấp nhận được.
        var allIds = rows.Select(r => r.QuestionId).ToList();
        var questions = (await _uow.Repository<Question>().FindAsync(q => allIds.Contains(q.Id)))
            .ToDictionary(q => q.Id);

        var byPart = rows
            .Where(r => questions.ContainsKey(r.QuestionId))
            .GroupBy(r => (int)questions[r.QuestionId].Part)
            .Select(g => new ReviewPartCount(g.Key, g.Count()))
            .OrderBy(x => x.Part)
            .ToList();

        // Lọc SAU khi đếm: thanh lọc phải luôn hiện đủ mọi Part, nếu không thì lọc sang
        // Part 5 rồi là không có đường quay lại các Part khác.
        var filtered = rows
            .Where(r => questions.ContainsKey(r.QuestionId))
            .Where(r => part is null || (int)questions[r.QuestionId].Part == part)
            // Sai nhiều lần lên trước, rồi mới đến mới sai. Câu sai đi sai lại là điểm yếu
            // dai dẳng — đáng gặp trước một câu vừa sai lần đầu.
            .OrderByDescending(r => r.WrongCount)
            .ThenByDescending(r => r.LastWrongAt)
            .ToList();

        var page = filtered.Skip(skip).Take(take).ToList();
        if (page.Count == 0)
            return Result<ReviewNotebookResponse>.Success(new ReviewNotebookResponse(rows.Count, byPart, []));

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

            items.Add(new ReviewQuestionItem(
                q.Id,
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
            new ReviewNotebookResponse(rows.Count, byPart, items));
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
