using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Practice;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Domain.Enums;

namespace ToeicMasterPro.Infrastructure.Services
{
    public class PracticeService : IPracticeService
    {
        private readonly IUnitOfWork _uow;

        public PracticeService(IUnitOfWork uow)
        {
            _uow = uow;
        }

        public async Task<IReadOnlyList<PracticeQuestionResponse>> GetQuestionsAsync(
        QuestionPart? part,
        DifficultyLevel? difficulty,
        string? tag,
        int limit)
        {
            // Giới hạn 1–50 để tránh lấy hết kho một lần
            if (limit < 1) limit = 10;
            if (limit > 50) limit = 50;

            //Chỉ lấy câu public, user k thấy bản nháp CM
            var questions = await _uow.Repository<Question>().FindAsync(q =>
                q.IsPublished && (part == null || q.Part == part) && (difficulty == null || q.Difficulty == difficulty));

            if (tag is not null)
            {
                questions = questions.Where(q => q.Tags.Contains(tag, StringComparer.OrdinalIgnoreCase)).ToList();
            }

            // Random rồi lấy limit câu (luyện khác nhau mỗi lần)
            var picked = questions
                .OrderBy(_ => Guid.NewGuid())
                .Take(limit)
                .ToList();

            if (picked.Count == 0) return [];
            //Lấy danh sách question id đã lọc
            var ids = picked.Select(q => q.Id).ToList();
            //lấy ra các câu hỏi có id nằm trong danh sách
            var options = await _uow.Repository<QuestionOption>()
                .FindAsync(o => ids.Contains(o.QuestionId));
            var byQ = options.GroupBy(o => o.QuestionId)
                .ToDictionary(g => g.Key, g => g.OrderBy(o => o.Label).ToList());


            // Map CHE IsCorrect + Explanation
            return picked.Select(q =>
            {
                var opts = byQ.GetValueOrDefault(q.Id) ?? [];
                return new PracticeQuestionResponse(
                    q.Id, q.Part, q.Difficulty, q.Content,
                    q.AudioUrl, q.ImageUrl, q.Passage, q.Tags,
                    opts.Select(o => new PracticeOptionDto(o.Id, o.Label, o.Content)).ToList()
                );
            }).ToList();
        }
        public async Task<Result<PracticeResultResponse>> SubmitAsync(SubmitPracticeRequest req)
        {
            if (req.Answers is null || req.Answers.Count == 0)
                return Result<PracticeResultResponse>.Failure("Chưa có đáp án nào.");
            // Chống trùng questionId trong 1 lần nộp
            var questionIds = req.Answers.Select(a => a.QuestionId).Distinct().ToList();
            if (questionIds.Count != req.Answers.Count)
                return Result<PracticeResultResponse>.Failure("Danh sách đáp án bị trùng câu hỏi.");
            var questions = await _uow.Repository<Question>()
                .FindAsync(q => questionIds.Contains(q.Id) && q.IsPublished);
            if (questions.Count != questionIds.Count)
                return Result<PracticeResultResponse>.Failure("Có câu hỏi không hợp lệ hoặc chưa publish.");
            var options = await _uow.Repository<QuestionOption>()
                .FindAsync(o => questionIds.Contains(o.QuestionId));
            //Nhóm các questionId vào tạo key= questionId, value= mảng options
            var optionsByQ = options.GroupBy(o => o.QuestionId)
                .ToDictionary(g => g.Key, g => g.ToList());
            var questionById = questions.ToDictionary(q => q.Id);
            var reviews = new List<PracticeAnswerReview>();
            var correct = 0;
            var skipped = 0;
            foreach (var ans in req.Answers)
            {
                //Lấy ra các option của câu hỏi
                var opts = optionsByQ.GetValueOrDefault(ans.QuestionId) ?? [];
                //Lấy ra đáp án chính xác
                var correctOpt = opts.FirstOrDefault(o => o.IsCorrect);
                if (correctOpt is null)
                    return Result<PracticeResultResponse>.Failure(
                        $"Câu {ans.QuestionId} chưa có đáp án đúng trong DB.");
                // null = bỏ qua → tính sai / skipped
                var isSkipped = ans.SelectedOptionId is null;
                if (isSkipped) skipped++;
                //nếu ko bỏ qua, câu trả lời đúng
                var isCorrect = !isSkipped && ans.SelectedOptionId == correctOpt.Id;
                //tăng câu đúng
                if (isCorrect) correct++;
                reviews.Add(new PracticeAnswerReview(
                    ans.QuestionId,
                    ans.SelectedOptionId,
                    correctOpt.Id,
                    correctOpt.Label,
                    isCorrect,
                    questionById[ans.QuestionId].Explanation
                ));
            }
            var total = req.Answers.Count;
            var percent = total == 0 ? 0 : Math.Round(correct * 100.0 / total, 1);
            return Result<PracticeResultResponse>.Success(new PracticeResultResponse(
                total, correct, skipped, percent, reviews
            ));
        }

    }
}
