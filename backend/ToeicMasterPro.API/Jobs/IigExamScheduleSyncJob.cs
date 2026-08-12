using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.API.Jobs
{
    public class IigExamScheduleSyncJob
    {
        private readonly IIigExamScheduleSyncService _sync;
        public IigExamScheduleSyncJob(IIigExamScheduleSyncService sync)
        {
            _sync = sync;
        }
        public Task RunAsync()
        {
            return _sync.SyncAsync();
        }
    }
}
