using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Questions;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;
using OfficeOpenXml;


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


    public async Task<ImportResultResponse> ImportAsync(Stream fileStream)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

        var errors = new List<ImportRowError>();
        var toInsert = new List<Question>();

        using var package = new ExcelPackage(fileStream);
        var sheet = package.Workbook.Worksheets[0];
        var rowCount = sheet.Dimension?.Rows ?? 0;

        // Row 1 là header, bắt đầu từ row 2
        for (int row = 2; row <= rowCount; row++)
        {
            // Đọc từng cell
            var partRaw = sheet.Cells[row, 1].GetValue<string>();
            var diffRaw = sheet.Cells[row, 2].GetValue<string>();
            var content = sheet.Cells[row, 3].GetValue<string>();
            var explanation = sheet.Cells[row, 4].GetValue<string>();
            var audioUrl = sheet.Cells[row, 5].GetValue<string>();
            var imageUrl = sheet.Cells[row, 6].GetValue<string>();
            var passage = sheet.Cells[row, 7].GetValue<string>();
            var tagsRaw = sheet.Cells[row, 8].GetValue<string>();
            var isPublished = sheet.Cells[row, 9].GetValue<string>();
            var optA = sheet.Cells[row, 10].GetValue<string>();
            var optB = sheet.Cells[row, 11].GetValue<string>();
            var optC = sheet.Cells[row, 12].GetValue<string>();
            var optD = sheet.Cells[row, 13].GetValue<string>();
            var correctRaw = sheet.Cells[row, 14].GetValue<string>();

            // Validate Part
            if (!int.TryParse(partRaw, out var partInt) || partInt < 1 || partInt > 7)
            { errors.Add(new ImportRowError(row, "Part không hợp lệ (phải là số 1–7).")); continue; }

            // Validate Difficulty
            if (!Enum.TryParse<DifficultyLevel>(diffRaw, true, out var difficulty))
            { errors.Add(new ImportRowError(row, "Difficulty không hợp lệ (Easy/Medium/Hard).")); continue; }

            // Validate Content
            if (string.IsNullOrWhiteSpace(content))
            { errors.Add(new ImportRowError(row, "Content không được trống.")); continue; }

            // Validate Options — tối thiểu A và B
            if (string.IsNullOrWhiteSpace(optA) || string.IsNullOrWhiteSpace(optB))
            { errors.Add(new ImportRowError(row, "Phải có ít nhất 2 đáp án (A và B).")); continue; }

            // Validate CorrectAnswer
            var correct = correctRaw?.Trim().ToUpper();
            if (correct is not ("A" or "B" or "C" or "D"))
            { errors.Add(new ImportRowError(row, "CorrectAnswer phải là A, B, C hoặc D.")); continue; }

            // Build options — chỉ thêm option nào có nội dung
            var optionMap = new Dictionary<string, string?>
            {
                ["A"] = optA,
                ["B"] = optB,
                ["C"] = optC,
                ["D"] = optD
            };
            var options = optionMap
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                .Select(kv => new QuestionOption
                {
                    Label = kv.Key,
                    Content = kv.Value!,
                    IsCorrect = kv.Key == correct
                }).ToList();

            // Parse tags
            var tags = string.IsNullOrWhiteSpace(tagsRaw)
                ? Array.Empty<string>()
                : tagsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            toInsert.Add(new Question
            {
                Part = (QuestionPart)partInt,
                Difficulty = difficulty,
                Content = content,
                Explanation = explanation ?? string.Empty,
                AudioUrl = audioUrl,
                ImageUrl = imageUrl,
                Passage = passage,
                Tags = tags,
                IsPublished = string.Equals(isPublished, "true", StringComparison.OrdinalIgnoreCase),
                Options = options
            });
        }

        // Insert tất cả câu hợp lệ
        foreach (var q in toInsert)
            await _uow.Repository<Question>().AddAsync(q);

        if (toInsert.Count > 0)
            await _uow.SaveChangesAsync();

        return new ImportResultResponse(
            TotalRows: rowCount - 1,
            SuccessCount: toInsert.Count,
            FailedCount: errors.Count,
            Errors: errors
        );
    }
}