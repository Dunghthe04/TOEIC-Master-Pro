using ToeicMasterPro.Application.Common;
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


    /// <summary>
    /// Đọc file Excel và tạo Question trong DB.
    ///
    /// Được gọi từ 2 nơi:
    ///   - POST /api/question/import          → import kho câu chung (không gắn đề)
    ///   - POST /api/test/{id}/import-listening → import kèm TestId (tự sinh URL media theo đề)
    ///
    /// Cột Excel (sheet đầu tiên, hàng 1 = header, từ hàng 2 = dữ liệu):
    ///   1–14: Part, Difficulty, Content, Explanation, AudioUrl, ImageUrl, Passage, Tags,
    ///          IsPublished, A, B, C, D, CorrectAnswer
    ///   15–17 (Day 27): OrderIndex, AudioFile, ImageFile
    ///
    /// Logic media khi có TestId:
    ///   - AudioFile/ImageFile trống → tự sinh theo ToeicMediaNaming (E26-T01-7.mp3, E26-T01-38-40.mp3)
    ///   - ResolveMediaUrl → /uploads/tests/{testId}/audio/{tên file}
    ///   - File phải đã nằm trên disk (ZIP giải nén trước hoặc upload riêng)
    /// </summary>
    public async Task<ImportResultResponse> ImportAsync(Stream fileStream, ImportQuestionOptions? options = null)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        options ??= new ImportQuestionOptions();

        var errors = new List<ImportRowError>();
        var created = new List<ImportQuestionCreatedItem>();

        // Load đề thi để lấy Series + Title — dùng sinh tên file audio/ảnh mặc định
        Test? test = null;
        if (options.TestId is { } testId)
            test = await _uow.Repository<Test>().GetByIdAsync(testId);

        using var package = new ExcelPackage(fileStream);
        var sheet = package.Workbook.Worksheets[0];
        var rowCount = sheet.Dimension?.Rows ?? 0;

        // Bắt đầu từ hàng 2 — hàng 1 là tiêu đề cột
        for (int row = 2; row <= rowCount; row++)
        {
            var partRaw = sheet.Cells[row, 1].GetValue<string>();
            // Bỏ qua dòng trống cuối file Excel
            if (string.IsNullOrWhiteSpace(partRaw)) continue;
            var diffRaw = sheet.Cells[row, 2].GetValue<string>();
            var content = sheet.Cells[row, 3].GetValue<string>();
            var explanation = sheet.Cells[row, 4].GetValue<string>();
            var audioUrlRaw = sheet.Cells[row, 5].GetValue<string>();
            var imageUrlRaw = sheet.Cells[row, 6].GetValue<string>();
            var passage = sheet.Cells[row, 7].GetValue<string>();
            var tagsRaw = sheet.Cells[row, 8].GetValue<string>();
            var isPublished = sheet.Cells[row, 9].GetValue<string>();
            var optA = sheet.Cells[row, 10].GetValue<string>();
            var optB = sheet.Cells[row, 11].GetValue<string>();
            var optC = sheet.Cells[row, 12].GetValue<string>();
            var optD = sheet.Cells[row, 13].GetValue<string>();
            var correctRaw = sheet.Cells[row, 14].GetValue<string>();
            // Cột mở rộng Day 27 — dùng cho import-listening (gán vào đề + media)
            var orderRaw = sheet.Cells[row, 15].GetValue<string>();   // vị trí câu trong đề: 1–100
            var audioFile = sheet.Cells[row, 16].GetValue<string>();  // tên file, vd E26-T01-7.mp3
            var imageFile = sheet.Cells[row, 17].GetValue<string>();  // tên file ảnh Part 1

            if (!int.TryParse(partRaw, out var partInt) || partInt < 1 || partInt > 7)
            { errors.Add(new ImportRowError(row, "Part không hợp lệ (phải là số 1–7).")); continue; }

            if (!Enum.TryParse<DifficultyLevel>(diffRaw, true, out var difficulty))
                difficulty = DifficultyLevel.Medium;

            if (string.IsNullOrWhiteSpace(content))
                content = partInt <= 2 ? string.Empty : $"Question row {row}";

            if (string.IsNullOrWhiteSpace(optA) || string.IsNullOrWhiteSpace(optB))
            { errors.Add(new ImportRowError(row, "Phải có ít nhất 2 đáp án (A và B).")); continue; }

            var correct = correctRaw?.Trim().ToUpper();
            if (correct is not ("A" or "B" or "C" or "D"))
            { errors.Add(new ImportRowError(row, "CorrectAnswer phải là A, B, C hoặc D.")); continue; }

            var optionMap = new Dictionary<string, string?>
            {
                ["A"] = optA, ["B"] = optB, ["C"] = optC, ["D"] = optD
            };
            var options_list = optionMap
                .Where(kv => !string.IsNullOrWhiteSpace(kv.Value))
                .Select(kv => new QuestionOption
                {
                    Label = kv.Key,
                    Content = kv.Value!,
                    IsCorrect = kv.Key == correct
                }).ToList();

            var tags = string.IsNullOrWhiteSpace(tagsRaw)
                ? Array.Empty<string>()
                : tagsRaw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            int? orderIndex = null;
            if (int.TryParse(orderRaw, out var oi) && oi > 0)
                orderIndex = oi;

            // ── Tự sinh tên file nếu CM để trống cột AudioFile/ImageFile ──
            // Điều kiện: phải có TestId (import-listening) + OrderIndex
            // Part 1–4: audio; Part 1 thêm ảnh
            // Part 3–4: 3 câu dùng chung 1 file → E26-T01-38-40.mp3 (logic trong ToeicMediaNaming)
            if (string.IsNullOrWhiteSpace(audioFile) && orderIndex.HasValue && test is not null && partInt <= 4)
                audioFile = ToeicMediaNaming.BuildAudioFileName(test.Series, test.Title, partInt, orderIndex.Value);

            if (string.IsNullOrWhiteSpace(imageFile) && orderIndex.HasValue && test is not null && partInt == 1)
                imageFile = ToeicMediaNaming.BuildImageFileName(test.Series, test.Title, orderIndex.Value);

            // Ưu tiên: AudioFile/ImageFile → URL tương đối trên server
            // Fallback: cột AudioUrl/ImageUrl (URL ngoài hoặc path tùy chỉnh)
            var audioUrl = ResolveMediaUrl(audioUrlRaw, audioFile, options.TestId, "audio");
            var imageUrl = ResolveMediaUrl(imageUrlRaw, imageFile, options.TestId, "images");

            var entity = new Question
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
                Options = options_list
            };

            await _uow.Repository<Question>().AddAsync(entity);
            // Save từng dòng để có QuestionId ngay — Controller dùng Id này gán vào TestQuestion
            await _uow.SaveChangesAsync();
            created.Add(new ImportQuestionCreatedItem(entity.Id, orderIndex));
        }

        return new ImportResultResponse(
            TotalRows: Math.Max(0, rowCount - 1),
            SuccessCount: created.Count,
            FailedCount: errors.Count,
            Errors: errors,
            Created: created
        );
    }

  public Task<byte[]> GetImportTemplateAsync()
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        using var package = new ExcelPackage();
        var sheet = package.Workbook.Worksheets.Add("Questions");
        var headers = new[]
        {
            "Part", "Difficulty", "Content", "Explanation", "AudioUrl", "ImageUrl",
            "Passage", "Tags", "IsPublished", "A", "B", "C", "D", "CorrectAnswer",
            "OrderIndex", "AudioFile", "ImageFile"
        };
        for (int i = 0; i < headers.Length; i++)
            sheet.Cells[1, i + 1].Value = headers[i];

        // Dòng mẫu Part 4 — AudioFile để trống → tự sinh E26-T01-71-73.mp3 khi import kèm testId
        sheet.Cells[2, 1].Value = 4;
        sheet.Cells[2, 2].Value = "Medium";
        sheet.Cells[2, 3].Value = "What type of products does the business repair?";
        sheet.Cells[2, 9].Value = "true";
        sheet.Cells[2, 10].Value = "Computers";
        sheet.Cells[2, 11].Value = "Vehicles";
        sheet.Cells[2, 12].Value = "Light fixtures";
        sheet.Cells[2, 13].Value = "Kitchen appliances";
        sheet.Cells[2, 14].Value = "A";
        sheet.Cells[2, 15].Value = 71;
        sheet.Cells[2, 16].Value = ""; // → E26-T01-71-73.mp3

        sheet.Cells[3, 1].Value = 3;
        sheet.Cells[3, 15].Value = 38;
        sheet.Cells[3, 16].Value = "E26-T01-38-40.mp3";

        sheet.Cells[4, 1].Value = 1;
        sheet.Cells[4, 15].Value = 1;
        sheet.Cells[4, 16].Value = "E26-T01-1.mp3";

        return Task.FromResult(package.GetAsByteArray());
    }

    /// <summary>
    /// Chuyển tên file hoặc URL thành đường dẫn lưu trong DB.
    ///
    /// Thứ tự ưu tiên:
    ///   1. fileName (cột AudioFile/ImageFile) → path tương đối trên wwwroot
    ///   2. url (cột AudioUrl/ImageUrl)         → dùng nguyên giá trị CM nhập
    ///   3. null                                 → câu không có media
    ///
    /// Có testId: /uploads/tests/{testId}/audio/ETS26-T01-7.mp3
    /// Không testId: /uploads/listening/audio/... (import kho câu chung)
    /// </summary>
    private static string? ResolveMediaUrl(string? url, string? fileName, Guid? testId, string subFolder)
    {
        if (!string.IsNullOrWhiteSpace(fileName))
        {
            var name = ToeicMediaNaming.NormalizeMediaFileName(fileName.Trim());
            return testId.HasValue
                ? $"/uploads/tests/{testId}/{subFolder}/{name}"
                : $"/uploads/listening/{subFolder}/{name}";
        }
        return string.IsNullOrWhiteSpace(url) ? null : url.Trim();
    }
}