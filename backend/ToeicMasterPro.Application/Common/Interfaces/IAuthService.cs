using ToeicMasterPro.Application.DTOs.Auth;
using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Application.Common.Interfaces;

public interface IAuthService
{
    Task<Result> RegisterAsync(RegisterRequest req);
    Task<Result<AuthResponse>> LoginAsync(LoginRequest req);
    Task<Result<AuthResponse>> RefreshTokenAsync(string refreshToken);
    Task<Result> LogoutAsync(string refreshToken);
    Task<Result> ConfirmEmailAsync(Guid userId, string token);
}
