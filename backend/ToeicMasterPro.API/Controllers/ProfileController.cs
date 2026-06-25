using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.DTOs.Profile;

namespace ToeicMasterPro.API.Controllers;

/*
Vì sao file được xử lý ở Controller chứ không ở Service?
Vì IFormFile/lưu file là chuyện của tầng web (HTTP). Service chỉ nhận chuỗi avatarUrl để ghi xuống DB → giữ tầng Application/Infrastructure sạch, 
không dính kiểu dữ liệu của ASP.NET.
*/
[ApiController]
[Route("api/profile")]
[Authorize]// mọi endpoint bắt buộc phải có accesstoken
public class ProfileController : ControllerBase
{
    private readonly IProfileService _profile;
    private readonly IWebHostEnvironment _env;

    public ProfileController(IProfileService profile, IWebHostEnvironment env)
    {
        _profile = profile;
        _env = env;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMe()
    {
        var result = await _profile.GetMyProfileAsync();
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateProfileRequest req)
    {
        var result = await _profile.UpdateMyProfileAsync(req);
        return result.IsSuccess ? Ok(result.Value) : NotFound(new { error = result.Error });
    }
    [HttpPost("me/avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "Chưa chọn file" });
        if (file.Length > 2 * 1024 * 1024)
            return BadRequest(new { error = "File quá lớn. Tối đa 2MB" });
        
        //Danh sách đuôi file cho phép
        var allowed = new[] { ".jpg", ".jpeg", ".png", ".webp" };
        //Lấy đuôi file
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!allowed.Contains(ext))
            return BadRequest(new { error = "Chỉ chấp nhận .jpg, .png, .webp." });
        // Lưu vào wwwroot/uploads/avatars/<guid>.ext
        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        //D:\Project\wwwroot\uploads\avatars
        var folder = Path.Combine(webRoot, "uploads", "avatars");
        Directory.CreateDirectory(folder);

        //Tạo tên file ngẫu nhiên
        var fileName = $"{Guid.NewGuid()}{ext}";
        await using (var stream = System.IO.File.Create(Path.Combine(folder, fileName)))
            await file.CopyToAsync(stream);

        //url ảnh
        var url = $"/uploads/avatars/{fileName}";
        var result = await _profile.UpdateAvatarAsync(url);

        return result.IsSuccess ? Ok(new { message = "Đã cập nhật ảnh đại diện." }) : BadRequest(new { error = result.Error });
    }


}