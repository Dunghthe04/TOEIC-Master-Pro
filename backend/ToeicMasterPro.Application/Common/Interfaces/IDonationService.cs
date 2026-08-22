using ToeicMasterPro.Application.DTOs.Donations;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IDonationService
{
    /// <summary>Tạo mã QR nhận tiền cho một lượt ủng hộ với số tiền cho trước.</summary>
    Task<Result<DonationQrResponse>> CreateQrAsync(int amount);

    /// <summary>
    /// Hỏi xem lượt ủng hộ đó đã nhận được tiền chưa. Frontend gọi lại theo chu kỳ trong
    /// lúc popup còn mở để biết khi nào chuyển sang lời cảm ơn.
    /// </summary>
    Task<Result<DonationStatusResponse>> GetStatusAsync(long orderCode);
}
