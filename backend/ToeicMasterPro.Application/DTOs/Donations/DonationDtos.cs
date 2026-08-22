namespace ToeicMasterPro.Application.DTOs.Donations;

/// <summary>
/// Người ủng hộ chỉ chọn số tiền — không thu tên/email vì đây là ủng hộ ẩn danh, và mỗi
/// field thu thêm là một field phải bảo vệ.
/// </summary>
public record CreateDonationQrRequest(int Amount);

/// <summary>
/// Dữ liệu để frontend vẽ mã QR và hiện thông tin tài khoản nhận.
///
/// QrCode là chuỗi VietQR thô theo chuẩn EMVCo (payOS trả về vậy), KHÔNG phải ảnh —
/// frontend tự render thành hình. Kèm số/tên tài khoản để người quét QR không được vẫn
/// chuyển khoản tay được, nhưng khi đó phải gõ đúng Description thì payOS mới đối soát
/// được lượt chuyển đó với đơn này.
/// </summary>
public record DonationQrResponse(
    long OrderCode,
    int Amount,
    string QrCode,
    string BankName,
    string AccountNumber,
    string AccountName,
    string Description,
    string CheckoutUrl,
    DateTimeOffset? ExpiredAt
);

/// <summary>
/// Trạng thái một lượt ủng hộ.
///
/// IsPaid là thứ frontend thật sự cần (đổi popup sang lời cảm ơn). Status trả kèm để phân
/// biệt "chưa chuyển" với "đã huỷ / hết hạn" — hai ca đó popup phải nói khác nhau.
/// AmountPaid để nói đúng con số trong lời cảm ơn, vì người ủng hộ sửa được số tiền trong
/// app ngân hàng nên nó có thể khác số của mã.
/// </summary>
public record DonationStatusResponse(
    long OrderCode,
    string Status,
    bool IsPaid,
    int AmountPaid
);
