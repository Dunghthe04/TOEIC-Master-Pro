using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

/*
1. Bắt tất cả các exception chưa được xử lý trong ứng dụng.
2. Ghi log lỗi vào hệ thống log.
3. Trả về một phản hồi JSON thống nhất cho client thay vì làm ứng dụng bị crash hoặc trả về lỗi mặc định khó hiểu.
*/
namespace ToeicMasterPro.API.Middleware;
//Khi có exception xảy ra -> Asp gọi đến class này để xử lý
public class GlobalExceptionHandler : IExceptionHandler
{
    //Logger dùng để ghi lỗi
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    //Gọi mỗi khi có exception
    //httpcontext: thông tin request hiện tại (httpcontext.request, httpcontext.response, route_data)
    //cancellationtoken: token hủy request
    //hàm return true(xử lý xong), false(chưa xử lý xong)
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        //Ghi thông tin lỗi vào log
        _logger.LogError(exception, "Exception occurred: {Message}", exception.Message);
        //Tạo đối tượng mô tả lỗi
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Internal Server Error",
            Detail = "An unexpected error. Please try again later."
        };
        //thiết laajo http statsu trả về
        httpContext.Response.StatusCode = problem.Status!.Value;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }


}