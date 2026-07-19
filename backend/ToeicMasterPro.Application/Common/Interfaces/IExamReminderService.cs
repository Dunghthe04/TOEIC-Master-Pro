using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces
{
    public interface IExamReminderService
    {
        //User đăng ký nhắc cgi 1 kỳ thi
        Task<Result> SubscribeAsync(Guid examScheduleId);

        //Hủy nhắc
        Task<Result> UnsubscribeAsync(Guid examScheduleId);

        //Hangfire gọi: gửi mail các reminder đến hạn
        Task ProcessDueRemindersAsync();

        // Danh sách ExamScheduleId user đã đặt nhắc (UI tô màu chuông)
        Task<IReadOnlyList<Guid>> GetMyReminderExamIdsAsync();
    }
}
