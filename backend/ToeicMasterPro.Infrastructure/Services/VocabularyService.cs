using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Vocabularies;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services;

public class VocabularyService : IVocabularyService
{
    private readonly IUnitOfWork _uow;

    public VocabularyService(IUnitOfWork uow) => _uow = uow;

    public async Task<IReadOnlyList<VocabularyResponse>> GetListAsync(
        VocabTopic? topic, string? search)
    {
        var searchNorm = string.IsNullOrWhiteSpace(search) ? null : search.Trim().ToLower();

        var list = await _uow.Repository<Vocabulary>().FindAsync(v =>
            (topic == null || v.Topic == topic) &&
            (searchNorm == null || v.Word.ToLower().Contains(searchNorm)));

        return list.OrderBy(v => v.Word).Select(Map).ToList();
    }

    public async Task<Result<VocabularyResponse>> GetByIdAsync(Guid id)
    {
        var entity = await _uow.Repository<Vocabulary>().GetByIdAsync(id);
        if (entity is null)
            return Result<VocabularyResponse>.Failure("Không tìm thấy từ vựng.");
        return Result<VocabularyResponse>.Success(Map(entity));
    }

    public async Task<Result<Guid>> CreateAsync(CreateVocabularyRequest req)
    {
        var err = Validate(req.Word, req.Definition, req.WordType, req.Topic);
        if (err is not null)
            return Result<Guid>.Failure(err);

        var word = req.Word.Trim();
        // Word unique trong DB — kiểm tra trước để báo lỗi rõ
        var dup = await _uow.Repository<Vocabulary>()
            .FindAsync(v => v.Word.ToLower() == word.ToLower());
        if (dup.Count > 0)
            return Result<Guid>.Failure("Từ này đã tồn tại trong kho.");

        var entity = new Vocabulary
        {
            Word = word,
            Phonetic = req.Phonetic?.Trim() ?? "",
            Definition = req.Definition.Trim(),
            DefinitionEn = req.DefinitionEn?.Trim() ?? "",
            ExampleSentence = req.ExampleSentence,
            AudioUrl = req.AudioUrl,
            Topic = req.Topic,
            WordType = req.WordType.Trim()
        };

        await _uow.Repository<Vocabulary>().AddAsync(entity);
        await _uow.SaveChangesAsync();
        return Result<Guid>.Success(entity.Id);
    }

    public async Task<Result> UpdateAsync(Guid id, UpdateVocabularyRequest req)
    {
        var err = Validate(req.Word, req.Definition, req.WordType, req.Topic);
        if (err is not null)
            return Result.Failure(err);

        var entity = await _uow.Repository<Vocabulary>().GetByIdAsync(id);
        if (entity is null)
            return Result.Failure("Không tìm thấy từ vựng.");

        var word = req.Word.Trim();
        var dup = await _uow.Repository<Vocabulary>()
            .FindAsync(v => v.Id != id && v.Word.ToLower() == word.ToLower());
        if (dup.Count > 0)
            return Result.Failure("Từ này đã tồn tại trong kho.");

        entity.Word = word;
        entity.Phonetic = req.Phonetic?.Trim() ?? "";
        entity.Definition = req.Definition.Trim();
        entity.DefinitionEn = req.DefinitionEn?.Trim() ?? "";
        entity.ExampleSentence = req.ExampleSentence;
        entity.AudioUrl = req.AudioUrl;
        entity.Topic = req.Topic;
        entity.WordType = req.WordType.Trim();
        entity.SetUpdatedAt();

        _uow.Repository<Vocabulary>().Update(entity);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    public async Task<Result> DeleteAsync(Guid id)
    {
        var entity = await _uow.Repository<Vocabulary>().GetByIdAsync(id);
        if (entity is null)
            return Result.Failure("Không tìm thấy từ vựng.");

        // Cascade: xóa từ → xóa UserVocabularies (Fluent API)
        _uow.Repository<Vocabulary>().Remove(entity);
        await _uow.SaveChangesAsync();
        return Result.Success();
    }

    private static string? Validate(string word, string definition, string wordType, VocabTopic topic)
    {
        if (string.IsNullOrWhiteSpace(word)) return "Word không được trống.";
        if (word.Trim().Length > 100) return "Word tối đa 100 ký tự.";
        if (string.IsNullOrWhiteSpace(definition)) return "Definition (nghĩa Việt) không được trống.";
        if (string.IsNullOrWhiteSpace(wordType)) return "WordType không được trống (noun/verb/adj...).";
        if (!Enum.IsDefined(typeof(VocabTopic), topic)) return "Topic không hợp lệ.";
        return null;
    }

    private static VocabularyResponse Map(Vocabulary v) => new(
        v.Id, v.Word, v.Phonetic, v.Definition, v.DefinitionEn,
        v.ExampleSentence, v.AudioUrl, v.Topic, v.WordType, v.CreatedAt
    );
}