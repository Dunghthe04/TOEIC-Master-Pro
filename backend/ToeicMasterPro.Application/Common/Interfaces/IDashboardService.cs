using ToeicMasterPro.Application.DTOs.Dashboard;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

/// <summary>
/// Dịch vụ dựng dữ liệu cho Dashboard.
///
/// TÁCH RIÊNG khỏi <see cref="ITestSessionService"/> một cách có chủ ý: khối "HÔM NAY" đọc
/// cả phiên thi, cả từ vựng, cả hồ sơ người dùng. Nhét vào TestSessionService thì dịch vụ
/// đó phải biết về từ vựng — một phụ thuộc không liên quan gì đến việc thi.
///
/// Đây là dịch vụ dựng VIEW MODEL: nó không có nghiệp vụ riêng, chỉ đọc và ghép.
/// </summary>
public interface IDashboardService
{
    /// <summary>
    /// Việc nên làm hôm nay của một người học.
    ///
    /// Luôn trả về Success kèm dữ liệu, kể cả khi người dùng chưa làm gì — xem chú thích
    /// "không bao giờ trả về màn hình rỗng" ở <see cref="TodayPlanResponse"/>.
    /// </summary>
    Task<Result<TodayPlanResponse>> GetTodayPlanAsync(Guid userId);
}
