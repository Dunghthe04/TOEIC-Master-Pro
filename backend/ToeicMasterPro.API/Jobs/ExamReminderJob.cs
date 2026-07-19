using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.API.Jobs
{
    public class ExamReminderJob
    {
        private readonly IExamReminderService _reminders;
        public ExamReminderJob(IExamReminderService reminders)
        {
            _reminders = reminders;
        }
        public Task RunAsync()
        {
            return _reminders.ProcessDueRemindersAsync();
        }
    }
}
