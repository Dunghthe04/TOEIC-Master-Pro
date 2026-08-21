using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.API.Extensions;

/// <summary>
/// Map Result/Result&lt;T&gt; sang IActionResult với ĐÚNG HTTP status.
///
/// VÌ SAO CẦN: trước đây mỗi controller tự viết
///     result.IsSuccess ? Ok(...) : BadRequest(new { error = result.Error })
/// — 45 chỗ, tất cả trả 400 cho mọi loại lỗi. Gom về một chỗ để:
///   1. Status code đúng theo ErrorType, không phải 400 hết
///   2. Khuôn response { error } giữ nguyên — frontend đang đọc field này, không phải sửa
///   3. Thêm loại lỗi mới chỉ sửa MỘT nơi
/// </summary>
public static class ResultExtensions
{
    /// <summary>Result&lt;T&gt; → 200 kèm Value, hoặc status theo ErrorType.</summary>
    public static IActionResult ToActionResult<T>(this Result<T> result, ControllerBase controller)
        => result.IsSuccess
            ? controller.Ok(result.Value)
            : Fail(controller, result.ErrorType, result.Error);

    /// <summary>
    /// Result&lt;T&gt; → 200 kèm payload TỰ CHỌN (không phải result.Value).
    /// Dùng khi controller muốn bọc lại, vd Ok(new { id = result.Value }).
    /// </summary>
    public static IActionResult ToActionResult<T>(this Result<T> result, ControllerBase controller, object payload)
        => result.IsSuccess
            ? controller.Ok(payload)
            : Fail(controller, result.ErrorType, result.Error);

    /// <summary>Result (không có Value) → 200 kèm message, hoặc status theo ErrorType.</summary>
    public static IActionResult ToActionResult(this Result result, ControllerBase controller, string successMessage)
        => result.IsSuccess
            ? controller.Ok(new { message = successMessage })
            : Fail(controller, result.ErrorType, result.Error);

    /// <summary>Result → 200 rỗng, hoặc status theo ErrorType.</summary>
    public static IActionResult ToActionResult(this Result result, ControllerBase controller)
        => result.IsSuccess
            ? controller.Ok()
            : Fail(controller, result.ErrorType, result.Error);

    /// <summary>
    /// Result&lt;T&gt; → 201 Created (kèm Location trỏ tới action xem chi tiết), hoặc
    /// status theo ErrorType.
    ///
    /// Cần overload riêng vì ToActionResult luôn trả 200: endpoint POST tạo mới phải
    /// giữ 201 + header Location, không hạ xuống 200.
    /// </summary>
    public static IActionResult ToCreatedResult<T>(
        this Result<T> result, ControllerBase controller, string actionName, object routeValues, object payload)
        => result.IsSuccess
            ? controller.CreatedAtAction(actionName, routeValues, payload)
            : Fail(controller, result.ErrorType, result.Error);

    private static IActionResult Fail(ControllerBase c, ErrorType type, string? error)
    {
        // Khuôn { error } giống trước — frontend (axios interceptor, AuthDialog...) đang
        // đọc err.response.data.error, đổi khuôn là vỡ hết chỗ hiển thị lỗi.
        var body = new { error };

        return type switch
        {
            ErrorType.NotFound => c.NotFound(body),
            ErrorType.Forbidden => c.StatusCode(StatusCodes.Status403Forbidden, body),
            ErrorType.Conflict => c.Conflict(body),
            ErrorType.Unauthorized => c.Unauthorized(body),
            _ => c.BadRequest(body),   // ErrorType.Validation và mặc định
        };
    }
}
