using ToeicMasterPro.Domain.Entities;
namespace ToeicMasterPro.Application.Common.Interfaces;
public interface ITokenService{
    string GenerateAccessToken(ApplicationUser user, IEnumerable<string> roles);

    // Trả cả 2: Entity để lưu DB (Token = HASH) và RawToken để gửi client qua cookie.
    // KHÔNG được lưu RawToken ở đâu — mất luôn sau lần trả về này.
    (RefreshToken Entity, string RawToken) GenerateRefreshToken(Guid userId);

    // Hash 1 refresh token thô (client gửi lên) theo ĐÚNG cách đã hash lúc lưu DB —
    // dùng để so sánh khi refresh/logout, không bao giờ so trực tiếp giá trị thô.
    string HashRefreshToken(string rawToken);
}