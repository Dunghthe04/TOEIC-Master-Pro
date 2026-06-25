namespace ToeicMasterPro.Application.Common.Interfaces;

//Cung cấp thông tin về User đang đăng nhập trong request hiện tại
public interface ICurrentUserService
{
    Guid? UserId { get; }
    string? Email { get; }
    bool IsAuthenticated { get; }
    IEnumerable<string> Roles { get; }
}
