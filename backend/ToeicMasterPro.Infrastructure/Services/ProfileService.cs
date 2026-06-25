using Microsoft.AspNetCore.Identity;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Profile;
using ToeicMasterPro.Domain.Common;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Services;

public class ProfileService : IProfileService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ICurrentUserService _currentUserService;

    public ProfileService(UserManager<ApplicationUser> userManager, ICurrentUserService currentUser)
    {
        _userManager = userManager;
        _currentUserService = currentUser;
    }

    public async Task<Result<ProfileResponse>> GetMyProfileAsync()
    {
        var user = await GetCurrentUserAsync();
        return user is null ? Result<ProfileResponse>.Failure("Không tìm thấy người dùng") : Result<ProfileResponse>.Success(MaptoResponse(user));
    }

    public async Task<Result<ProfileResponse>> UpdateMyProfileAsync(UpdateProfileRequest req)
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
            return Result<ProfileResponse>.Failure("Không tìm thấy người dùng");
        user.FullName = req.FullName;
        user.TargetScore = req.TargetScore;
        user.ExamDate = req.ExamDate;

        //Lưu vào db
        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded ?
            Result<ProfileResponse>.Success(MaptoResponse(user)) :
            Result<ProfileResponse>.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    public async Task<Result> UpdateAvatarAsync(string avatarUrl)
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
            return Result.Failure("Không tìm thấy người dùng");
        user.AvatarUrl = avatarUrl;
        var result = await _userManager.UpdateAsync(user);
        return result.Succeeded
            ? Result.Success()
            : Result.Failure(string.Join("; ", result.Errors.Select(e => e.Description)));
    }

    // Lấy user hiện tại dựa trên userId trong token
    private async Task<ApplicationUser?> GetCurrentUserAsync()
    {
        var userId = _currentUserService.UserId;
        return userId is null ? null : await _userManager.FindByIdAsync(userId.Value.ToString());
    }

    //hàm chuyển đổi ApplicationUser => ProfileResponse
    private static ProfileResponse MaptoResponse(ApplicationUser u) => new(
        u.Id, u.Email!, u.FullName, u.AvatarUrl, u.TargetScore,
        u.ExamDate, u.Plan.ToString(), u.XpPoints, u.StreakDays, u.CreatedAt);

}
