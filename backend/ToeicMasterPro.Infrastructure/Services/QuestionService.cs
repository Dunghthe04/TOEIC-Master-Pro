using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services;

public class QuestionService : IQuestionService
{
    private readonly IUnitOfWork _uow;

    public QuestionService(IUnitOfWork uow) => _uow = uow;

    //tạo câu hỏi
    public async Task<Result<Guid>> CreateAsync(CreateQuestionRequest req)
    {
        var error = Validate(req.Content, req.Options);
        if (error is not null) return Result<Guid>.Failure(error);

        var question = new Question
        {
            Part = req.Part,
            Difficulty = req.Difficulty,
            Content = req.Content,
            Explanation = req.Explanation,
            AudioUrl = req.AudioUrl,
            ImageUrl = req.ImageUrl,
            Passage = req.Passage,
            Tags = req.Tags,
            IsPublished = req.IsPublished,
            // Gán Options vào navigation → EF tự cascade-insert kèm khi lưu Question
            Options = req.Options.Select(o => new QuestionOption
            {
                Label = o.Label,
                Content = o.Content,
                IsCorrect = o.IsCorrect
            }).ToList()
        };
        //dùng _uow để gọi đến IRepository của đối tương, thao tác db của đối tượng
        await _uow.Repository<Question>().AddAsync(question);
        await _uow.SaveChangesAsync();
        return Result<Guid>.Success(question.Id);
    }

    public async Task<Result<QuestionResponse>> GetByIdAsync(Guid id)
    {
        var q = await _uow.Repository<Question>().GetByIdAsync(id);
        if (q is null) return Result<QuestionResponse>.Failure("Không tìm thấy câu hỏi.");

        var options = await _uow.Repository<QuestionOption>().FindAsync(o => o.QuestionId == id);
        return Result<QuestionResponse>.Success(MapToResponse(q, options.ToList()));
    }

    public async Task<IReadOnlyList<QuestionResponse>> GetListAsync(
    QuestionPart? part, DifficultyLevel? difficulty, bool? isPublished, string? tag)
    {
        var questions = await _uow.Repository<Question>().FindAsync(q =>
            (part == null || q.Part == part) &&
            (difficulty == null || q.Difficulty == difficulty) &&
            (isPublished == null || q.IsPublished == isPublished));

        // Filter tag in-memory — Tags là string[] được convert từ "a,b,c" trong DB
        // EF không dịch được sang SQL với value converter nên phải lọc sau khi fetch
        if (tag is not null)
            questions = questions
                .Where(q => q.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase))
                .ToList();

        var ids = questions.Select(q => q.Id).ToList();
        if (ids.Count == 0) return [];

        var options = await _uow.Repository<QuestionOption>().FindAsync(o => ids.Contains(o.QuestionId));
        var optionsByQ = options.GroupBy(o => o.QuestionId)
                                .ToDictionary(g => g.Key, g => g.ToList());

        return questions
            .Select(q => MapToResponse(q, optionsByQ.GetValueOrDefault(q.Id) ?? []))
            .ToList();
    }

    public async Task<Result> UpdateAsync(Guid id, UpdateQuestionRequest req)
    {
        var error = Validate(req.Content, req.Options);
        if (error is not null) return Result.Failure(error);

        var q = await _uow.Repository<Question>().GetByIdAsync(id);
        if (q is null) return Result.Failure("Không tìm thấy câu hỏi.");

        // Cập nhật field
        q.Part = req.Part;
        q.Difficulty = req.Difficulty;
        q.Content = req.Content;
        q.Explanation = req.Explanation;
        q.AudioUrl = req.AudioUrl;
        q.ImageUrl = req.ImageUrl;
        q.Passage = req.Passage;
        q.Tags = req.Tags;
        q.IsPublished = req.IsPublished;
        _uow.Repository<Question>().Update(q);

        // Thay toàn bộ đáp án: xóa cũ, thêm mới
        var oldOptions = await _uow.Repository<QuestionOption>().FindAsync(o => o.QuestionId == id);
        foreach (var o in oldOptions) _uow.Repository<QuestionOption>().Remove(o);
        foreach (var o in req.Options)
            await _uow.Repository<QuestionOption>().AddAsync(new QuestionOption
            {
                QuestionId = id,
                Label = o.Label,
                Content = o.Content,
                IsCorrect = o.IsCorrect
            });

        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid id)
    {
        var q = await _uow.Repository<Question>().GetByIdAsync(id);
        if (q is null) return Result.Failure("Không tìm thấy câu hỏi.");

        _uow.Repository<Question>().Remove(q);   // Options tự xóa theo (cascade)
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    //--Helpers--
    private static string? Validate(string content, List<CreateOptionRequest> options)
    {
        if (string.IsNullOrWhiteSpace(content)) return "Nội dung câu hỏi không được trống.";
        if (options is null || options.Count < 2) return "Phải có ít nhất 2 đáp án.";
        if (options.Count(o => o.IsCorrect) != 1) return "Phải có đúng 1 đáp án đúng.";
        return null;
    }

    private static QuestionResponse MapToResponse(Question q, List<QuestionOption> options)
      => new(
         q.Id, q.Part, q.Difficulty, q.Content, q.Explanation,
            q.AudioUrl, q.ImageUrl, q.Passage, q.Tags, q.IsPublished,
            options.Select(o => new OptionResponse(o.Id, o.Label, o.Content, o.IsCorrect)).ToList()
      );
}