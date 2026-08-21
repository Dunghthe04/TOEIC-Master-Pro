namespace ToeicMasterPro.Domain.Common;

/// <summary>
/// Loại lỗi nghiệp vụ — để controller map sang đúng HTTP status thay vì trả 400 cho mọi thứ.
///
/// Trước đây Result chỉ có Error (string) nên controller không có cách nào biết nên trả
/// 400 hay 404 → trả 400 hết. Hệ quả nghiêm trọng nhất: "Phiên thi không thuộc tài khoản
/// này" trả 400 khác với "Không tìm thấy phiên thi" cũng trả 400 nhưng THÔNG BÁO KHÁC →
/// kẻ tấn công dò id biết được id nào tồn tại (IDOR information disclosure).
/// </summary>
public enum ErrorType
{
    /// <summary>400 — dữ liệu vào sai, thiếu field, sai định dạng. Mặc định.</summary>
    Validation,

    /// <summary>
    /// 404 — không tìm thấy tài nguyên.
    ///
    /// ⚠️ DÙNG CẢ CHO trường hợp "tài nguyên của người khác": trả 404 thay vì 403 để
    /// không xác nhận tài nguyên đó tồn tại. 403 nói "có cái này nhưng bạn không được
    /// xem" — đủ để kẻ tấn công liệt kê id hợp lệ.
    /// </summary>
    NotFound,

    /// <summary>
    /// 403 — biết bạn là ai, không cho phép làm việc này.
    ///
    /// Chỉ dùng khi việc bị chặn KHÔNG gắn với một tài nguyên cụ thể nào (vd sai role),
    /// hoặc khi tài nguyên đó vốn đã công khai nên che cũng vô nghĩa.
    /// </summary>
    Forbidden,

    /// <summary>409 — tài nguyên tồn tại, nhưng trạng thái hiện tại không cho phép hành động này.</summary>
    Conflict,

    /// <summary>401 — chưa đăng nhập / token không hợp lệ.</summary>
    Unauthorized,
}

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public string? Error { get; }
    public ErrorType ErrorType { get; }

    private Result(T value) { IsSuccess = true; Value = value; }
    private Result(string error, ErrorType type) { IsSuccess = false; Error = error; ErrorType = type; }

    public static Result<T> Success(T value) => new(value);

    /// <summary>Lỗi validation (400). Giữ chữ ký cũ để 46 chỗ gọi hiện tại không phải sửa hết.</summary>
    public static Result<T> Failure(string error) => new(error, ErrorType.Validation);

    public static Result<T> Failure(string error, ErrorType type) => new(error, type);

    // ── Shortcut cho các loại hay dùng — đọc rõ ý định hơn Failure(msg, ErrorType.X) ──

    public static Result<T> NotFound(string error = "Không tìm thấy tài nguyên.")
        => new(error, ErrorType.NotFound);

    public static Result<T> Forbidden(string error = "Bạn không có quyền thực hiện việc này.")
        => new(error, ErrorType.Forbidden);

    public static Result<T> Conflict(string error) => new(error, ErrorType.Conflict);

    public static Result<T> Unauthorized(string error = "Chưa đăng nhập.")
        => new(error, ErrorType.Unauthorized);
}

public class Result
{
    public bool IsSuccess { get; }
    public string? Error { get; }
    public ErrorType ErrorType { get; }

    private Result(bool success, string? error, ErrorType type = ErrorType.Validation)
    {
        IsSuccess = success;
        Error = error;
        ErrorType = type;
    }

    public static Result Success() => new(true, null);

    /// <summary>Lỗi validation (400). Giữ chữ ký cũ để code hiện tại không phải sửa hết.</summary>
    public static Result Failure(string error) => new(false, error, ErrorType.Validation);

    public static Result Failure(string error, ErrorType type) => new(false, error, type);

    public static Result NotFound(string error = "Không tìm thấy tài nguyên.")
        => new(false, error, ErrorType.NotFound);

    public static Result Forbidden(string error = "Bạn không có quyền thực hiện việc này.")
        => new(false, error, ErrorType.Forbidden);

    public static Result Conflict(string error) => new(false, error, ErrorType.Conflict);

    public static Result Unauthorized(string error = "Chưa đăng nhập.")
        => new(false, error, ErrorType.Unauthorized);
}
