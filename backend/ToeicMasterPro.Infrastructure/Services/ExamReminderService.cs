using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;

namespace ToeicMasterPro.Infrastructure.Services
{
    public class ExamReminderService : IExamReminderService
    {

        private readonly IUnitOfWork _uow;
        private readonly ICurrentUserService _currentUser;
        private readonly ApplicationDbContext _db;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IEmailSender _email;
        public ExamReminderService(
             IUnitOfWork uow,
        ICurrentUserService currentUser,
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        IEmailSender email) {

            _uow = uow;
            _currentUser = currentUser;
            _db = db;
            _userManager = userManager;
            _email = email;

        }
        // Hangfire gọi mỗi ngày — gửi mail nếu còn ~3 ngày nữa tới ExamDate
        public async Task ProcessDueRemindersAsync()
        {
            // Phải .Date — không thì so DateTime có giờ → gần như không bao giờ khớp
            var targetDate = DateTime.UtcNow.Date.AddDays(3);

            var due = await _db.UserExamReminders
           .Include(r => r.User)
           .Include(r => r.ExamSchedule)
           .Where(r => !r.EmailSent
                       && r.ExamSchedule.IsActive
                       && r.ExamSchedule.ExamDate.Date == targetDate)
           .ToListAsync();

            foreach (var r in due)
            {
                var exam = r.ExamSchedule;
                var subject = $"[TOEIC Master Pro] Nhắc thi: {exam.Title}";
                var body =
                    $"Xin chào {r.User.FullName},\n\n" +
                    $"Kỳ thi \"{exam.Title}\" sẽ diễn ra vào {exam.ExamDate:dd/MM/yyyy} " +
                    $"lúc {exam.StartTime:hh\\:mm} tại {exam.Location} ({exam.City}).\n" +
                    $"Hạn đăng ký: {exam.RegistrationDeadline:dd/MM/yyyy}.\n" +
                    (string.IsNullOrEmpty(exam.RegisterUrl) ? "" : $"Link đăng ký: {exam.RegisterUrl}\n") +
                    "\nChúc bạn thi tốt!\nTOEIC Master Pro";
                await _email.SendAsync(r.User.Email!, subject, body);
                r.EmailSent = true;
            }

            if (due.Count > 0)
                await _db.SaveChangesAsync();
            else
                Console.WriteLine($"[ExamReminder] Không có reminder đến hạn. targetDate={targetDate:yyyy-MM-dd}");
        }

        public async Task<Result> SubscribeAsync(Guid examScheduleId)
        {
            if (_currentUser.UserId is null)
                return Result.Failure("Chưa đăng nhập.");

            var exam = await _uow.Repository<ExamSchedule>().GetByIdAsync(examScheduleId);
            if (exam is null || !exam.IsActive)
                return Result.Failure("Không tìm thấy lịch thi.");

            var userId = _currentUser.UserId.Value;
            // Unique (UserId, ExamScheduleId) — tránh đăng ký trùng
            var exists = await _uow.Repository<UserExamReminder>()
                .FindAsync(r => r.UserId == userId && r.ExamScheduleId == examScheduleId);
            if (exists.Count > 0)
                return Result.Failure("Bạn đã đặt nhắc cho kỳ thi này.");
            await _uow.Repository<UserExamReminder>().AddAsync(new UserExamReminder
            {
                UserId = userId,
                ExamScheduleId = examScheduleId,
                EmailSent = false
            });

            await _uow.SaveChangesAsync();
            return Result.Success();
        }

        public async Task<Result> UnsubscribeAsync(Guid examScheduleId)
        {
            if(_currentUser.UserId is null)
                return Result.Failure("Chưa đăng nhập.");
            var userId = _currentUser.UserId.Value;
            var list = await _uow.Repository<UserExamReminder>()
                .FindAsync(r=>r.UserId == userId && r.ExamScheduleId == examScheduleId);
            var entity = list.FirstOrDefault();
            if(entity is null)
                return Result.Failure("Bạn chưa đặt nhắc cho kỳ thi này.");

            _uow.Repository<UserExamReminder>().Remove(entity);
            await _uow.SaveChangesAsync();
            return Result.Success();
        }

        public async Task<IReadOnlyList<Guid>> GetMyReminderExamIdsAsync()
        {
            if (_currentUser.UserId is null)
                return [];

            var userId = _currentUser.UserId.Value;
            return await _db.UserExamReminders
                .Where(r => r.UserId == userId)
                .Select(r => r.ExamScheduleId)
                .ToListAsync();
        }
    }
}
