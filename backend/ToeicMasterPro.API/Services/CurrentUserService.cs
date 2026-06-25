using System.Security.Claims;
using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.API.Services;

//mục đích lấy thông tin user hiện tại trong request JWT
//ASP.NET giải mã token và tạo ra đối tượng ClaimsPrincipal chứa các thông tin claims (sub, email, role)
public class CurrentUserService : ICurrentUserService
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        => _httpContextAccessor = httpContextAccessor;

    //tạo ra một ClaimsPrincipal? bằng cách truy cập vàoHttpContext của request hiện tại
    //nếu không có request nào đang diễn ra, nó trả về null
    private ClaimsPrincipal? User => _httpContextAccessor.HttpContext?.User;

    public Guid? UserId
    {
        get
        {
            // sub trong token được map sang ClaimTypes.NameIdentifier; fallback "sub" cho chắc
            var id = User?.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? User?.FindFirstValue("sub");
            return Guid.TryParse(id, out var guid) ? guid : null;
        }
    }

    public string? Email => User?.FindFirstValue(ClaimTypes.Email) ?? User?.FindFirstValue("email");

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;

    public IEnumerable<string> Roles =>
        User?.FindAll(ClaimTypes.Role).Select(c => c.Value) ?? Enumerable.Empty<string>();
}
