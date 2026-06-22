using ToeicMasterPro.Domain.Entities;
namespace ToeicMasterPro.Application.Common.Interfaces;
public interface ITokenService{
    string GenerateAccessToken(ApplicationUser user, IEnumerable<string> roles);
    RefreshToken GenerateRefreshToken(Guid userId);
}