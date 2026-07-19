using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Srs;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.Infrastructure.Services
{
    public class SrsService : ISrsService
    {
        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly ApplicationDbContext _db;

        public SrsService(
        IUnitOfWork uow,
        ICurrentUserService currentUser,
        ApplicationDbContext db)
        {
            _uow = uow;
            _currentUser = currentUser;
            _db = db;
        }

        public async Task<IReadOnlyList<SrsCardResponse>> GetDueAsync()
        {
            if (_currentUser.UserId is null)
                return [];

            var userId = _currentUser.UserId.Value;
            var today = DateTime.UtcNow.Date;

            var due = await _db.UserVocabularies
                .Include(uv => uv.Vocabulary)
                .Where(uv => uv.UserId ==userId && uv.NextReviewDate.Date <= today)
                .OrderBy(uv=> uv.NextReviewDate)
                .ToListAsync();

            return due.Select(Map).ToList();


        }

        public async Task<Result<SrsProgressResponse>> GetProgressAsync()
        {
            if (_currentUser.UserId is null)
                return Result<SrsProgressResponse>.Failure("Chưa đăng nhập.");
            var userId = _currentUser.UserId.Value;
            var today = DateTime.UtcNow.Date;
            var all = await _db.UserVocabularies
                .Where(uv => uv.UserId == userId)
                .ToListAsync();
            var progress = new SrsProgressResponse(
                TotalTracking: all.Count,
                DueToday: all.Count(uv => uv.NextReviewDate.Date <= today),
                Learned: all.Count(uv => uv.IsLearned),
                Learning: all.Count(uv => !uv.IsLearned)
            );
            return Result<SrsProgressResponse>.Success(progress);

        }

        public async Task<Result<SrsCardResponse>> LearnAsync(Guid vocabularyId)
        {
            if (_currentUser.UserId is null)
                return Result<SrsCardResponse>.Failure("Chưa đăng nhập.");
            var userId = _currentUser.UserId.Value;
            var vocab = await _uow.Repository<Vocabulary>().GetByIdAsync(vocabularyId);
            if (vocab is null)
                return Result<SrsCardResponse>.Failure("Không tìm thấy từ vựng.");
            var existing = await _db.UserVocabularies
                .Include(uv => uv.Vocabulary)
                .FirstOrDefaultAsync(uv => uv.UserId == userId && uv.VocabularyId == vocabularyId);
            if (existing is not null)
                return Result<SrsCardResponse>.Success(Map(existing));
            var uv = new UserVocabulary
            {
                UserId = userId,
                VocabularyId = vocabularyId,
                RepetitionCount = 0,
                EaseFactor = 2.5f,
                IntervalDays = 1,
                NextReviewDate = DateTime.UtcNow, // ôn được ngay
                IsLearned = false
            };
            await _uow.Repository<UserVocabulary>().AddAsync(uv);
            await _uow.SaveChangesAsync();
            // Load lại kèm Vocabulary để Map
            uv.Vocabulary = vocab;
            return Result<SrsCardResponse>.Success(Map(uv));
        }

        public async Task<Result<SrsCardResponse>> ReviewAsync(ReviewRequest req)
        {
            if (_currentUser.UserId is null)
                return Result<SrsCardResponse>.Failure("Chưa đăng nhập.");
            if (req.Quality < 0 || req.Quality > 5)
                return Result<SrsCardResponse>.Failure("Quality phải từ 0 đến 5.");
            var userId = _currentUser.UserId.Value;
            var uv = await _db.UserVocabularies
                .Include(x => x.Vocabulary)
                .FirstOrDefaultAsync(x =>
                    x.UserId == userId && x.VocabularyId == req.VocabularyId);
            if (uv is null)
                return Result<SrsCardResponse>.Failure("Bạn chưa bắt đầu học từ này. Gọi learn trước.");
            ApplySm2(uv, req.Quality);
            uv.SetUpdatedAt();
            await _db.SaveChangesAsync();
            return Result<SrsCardResponse>.Success(Map(uv));
        }

        // ── SM-2 core ──────────────────────────────────────────
        // SuperMemo-2: cập nhật EaseFactor, Interval, Repetition, NextReview
        //EaseFactor (EF) = độ dễ của thẻ, càng cao càng dễ nhớ → ôn thưa hơn
        //Interval = khoảng cách ôn tập tiếp theo (ngày)
        // Repetition = số lần ôn tập thành công liên tiếp
        //NextReviewDate = ngày ôn tập tiếp theo
        private static void ApplySm2(UserVocabulary uv, int quality)
        {
            // EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
            var q = quality;
            var ef = uv.EaseFactor + (0.1f - (5 - q) * (0.08f + (5 - q) * 0.02f));
            if (ef < 1.3f) ef = 1.3f;
            uv.EaseFactor = ef;
            //Nếu chưa thuộc (<3) → ôn lại từ đầu, ngày tiếp theo = hôm sau
            if (quality < 3)
            {
                // Trả lời kém → ôn lại từ đầu
                uv.RepetitionCount = 0;
                uv.IntervalDays = 1;
            }
            //Nếu đã thuộc (>=3) → tăng khoảng cách ôn tập tiếp theo
            else
            {
                //Trả lời đúng và đúng lần đầu → tăng khoảng cách ôn tập tiếp theo
                if (uv.RepetitionCount == 0)
                    uv.IntervalDays = 1;
                //Trả lời đúng và đúng lần thứ 2 → tăng khoảng cách ôn tập tiếp theo =6
                else if (uv.RepetitionCount == 1)
                    uv.IntervalDays = 6;
                //trả lời đúng và đúng lần thứ 3 trở đi → tăng khoảng cách ôn tập tiếp theo = khoảng cách ôn tập trước đó * EF
                else
                    uv.IntervalDays = Math.Max(1, (int)Math.Round(uv.IntervalDays * uv.EaseFactor));
                uv.RepetitionCount += 1;
            }
            //Tính ngày review tiếp theo = ngày hôm nay + khoảng cách ôn tập tiếp theo
            uv.NextReviewDate = DateTime.UtcNow.Date.AddDays(uv.IntervalDays);
            // Theo docs: thuộc khi khoảng cách ôn > 21 ngày
            uv.IsLearned = uv.IntervalDays > 21;
        }


        private static SrsCardResponse Map(UserVocabulary uv)
        {
            var v = uv.Vocabulary;
            return new SrsCardResponse(
                v.Id, v.Word, v.Phonetic, v.Definition, v.DefinitionEn,
                v.ExampleSentence, v.AudioUrl, v.Topic, v.WordType,
                uv.RepetitionCount, uv.EaseFactor, uv.IntervalDays,
                uv.NextReviewDate, uv.IsLearned
            );
        }
    }
}
