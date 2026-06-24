using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IAuthService
{
    //Task = pthuc bat dong bo
    //Result = chỉ thông báo thành công/ thất bại, ko kèm dữ liệu
    //Result<T> = thành công kèm dữ liệu T
    Task<Result> RegisterAsync(RegisterRequest req);
    // Hàm đăng nhập, trả về Token + RefreshToken
    Task<Result<AuthResponse>> LoginAsync(LoginRequest req);
    // Làm mới token (lấy token mới bằng RefreshToken cũ)
    Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken);
    Task<Result> LogoutAsync(string refreshToken);
    Task<Result> ConfirmEmailAsync(Guid userId, string token);
    Task<Result> ForgotPasswordAsync(ForgotPasswordRequest req);
    Task<Result> ResetPasswordAsync(ResetPasswordRequest req);
    Task<Result<AuthResponse>> GoogleLoginAsync(string idToken);

}
