using ToeicMasterPro.Application.DTOs.Profile;
using ToeicMasterPro.Domain.Common;

public interface IProfileService
{
    Task<Result<ProfileResponse>> GetMyProfileAsync();
    Task<Result<ProfileResponse>> UpdateMyProfileAsync(UpdateProfileRequest req);
    Task<Result> UpdateAvatarAsync(string avatarUrl);
}