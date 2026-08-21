using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<ExamReminderService> _logger;
        public ExamReminderService(
             IUnitOfWork uow,
        ICurrentUserService currentUser,
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        IEmailSender email,
        ILogger<ExamReminderService> logger) {

            _uow = uow;
            _currentUser = currentUser;
            _db = db;
            _userManager = userManager;
            _email = email;
            _logger = logger;

        }
        // Hangfire gọi 07:00 mỗi ngày (giờ VN) — gửi mail nếu kỳ thi còn TỐI ĐA 3 ngày
        public async Task ProcessDueRemindersAsync()
        {
            // Dùng giờ VN, không phải UtcNow: cron đã đặt theo giờ VN (Program.cs).
            // Nếu để UtcNow thì khi cron chạy 06:00 VN (= 23:00 UTC hôm trước),
            // UtcNow.Date lệch MỘT NGÀY so với "hôm nay" mà user hiểu.
            var todayVn = DateTime.UtcNow.AddHours(7).Date;
            var windowEnd = todayVn.AddDays(3);

            // KHOẢNG (>= hôm nay && <= hôm nay+3), KHÔNG phải == hôm nay+3.
            //
            // Vì sao: với "== hôm nay+3", chỉ cần job lỡ MỘT lần chạy (app restart /
            // server sập đúng 07:00) là kỳ thi đó KHÔNG BAO GIỜ được nhắc — hôm sau nó
            // cách 2 ngày, không còn khớp điều kiện. Tệ hơn: user đặt nhắc khi kỳ thi
            // chỉ còn 2 ngày thì vĩnh viễn không nhận được mail nào.
            //
            // Không sợ gửi trùng vì EmailSent = true chặn ở lần chạy sau — mỗi reminder
            // vẫn chỉ gửi ĐÚNG MỘT LẦN dù nằm trong cửa sổ 4 ngày.
            //
            // >= todayVn để không gửi nhắc cho kỳ thi ĐÃ QUA (dữ liệu cũ trong DB).
            var due = await _db.UserExamReminders
           .Include(r => r.User)
           .Include(r => r.ExamSchedule)
           .Where(r => !r.EmailSent
                       && r.ExamSchedule.IsActive
                       && r.ExamSchedule.ExamDate.Date >= todayVn
                       && r.ExamSchedule.ExamDate.Date <= windowEnd)
           .ToListAsync();

            int sent = 0, failed = 0;

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

                // try/catch TỪNG mail: một địa chỉ lỗi (hộp thư đầy, domain sai, SMTP
                // timeout) không được làm chết cả loop — 9 người còn lại vẫn phải nhận.
                // Cùng pattern với IigExamScheduleSyncService (bắt lỗi từng tổ hợp).
                try
                {
                    await _email.SendAsync(r.User.Email!, subject, body);

                    // Lưu NGAY sau mỗi mail, KHÔNG gom cuối vòng lặp.
                    //
                    // Vì sao: gửi mail là hành động KHÔNG HOÀN TÁC ĐƯỢC, còn SaveChanges
                    // thì có thể lỗi (mất kết nối DB, app bị kill). Nếu gom cuối:
                    // 10 mail đã bay, SaveChanges lỗi → EmailSent vẫn false → lần chạy
                    // sau GỬI LẠI CẢ 10. Lưu từng cái thì phạm vi thiệt hại tối đa là
                    // MỘT mail trùng, thay vì toàn bộ lô.
                    //
                    // Đánh đổi: nhiều round-trip DB hơn. Chấp nhận được vì job này gửi
                    // vài mail mỗi ngày, không phải hàng nghìn.
                    r.EmailSent = true;
                    await _db.SaveChangesAsync();
                    sent++;
                }
                catch (Exception ex)
                {
                    failed++;
                    // KHÔNG set EmailSent → lần chạy sau tự thử lại (nhờ cửa sổ 3 ngày
                    // ở trên, không phải "đúng 3 ngày" như trước).
                    _logger.LogError(ex,
                        "ExamReminder: gửi mail thất bại cho {Email}, kỳ thi {ExamTitle}",
                        r.User.Email, exam.Title);
                }
            }

            // Dùng ILogger thay Console.WriteLine: job chạy nền, Console không vào
            // file log nên khi deploy là mất dấu — không biết mail có gửi hay không.
            _logger.LogInformation(
                "ExamReminder: {Sent} mail đã gửi, {Failed} thất bại, {Total} reminder đến hạn. " +
                "Cửa sổ {From:yyyy-MM-dd} → {To:yyyy-MM-dd}",
                sent, failed, due.Count, todayVn, windowEnd);
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
