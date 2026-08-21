using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ToeicMasterPro.API.Extensions;
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
// [Authorize] TRẦN ở đây là CỐ Ý, không phải bỏ sót Roles:
// profile là của chính mình → CẢ BA vai (User/CM/Admin) đều xem và sửa được.
//
// Về mặt kỹ thuật nó TRÙNG fallback policy (Program.cs) nên có thể xóa. Giữ lại vì
// giá trị tài liệu: đọc file là biết ngay ý định, không phải mở Program.cs kiểm.
// Đây là controller DUY NHẤT còn [Authorize] trần — các controller khác đều siết Roles.
[Authorize]
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
        // Trước hardcode 404 cho mọi lỗi. "Không tìm thấy người dùng" ở đây là token
        // không còn ứng với account nào → service trả Unauthorized, FE cho login lại.
        return result.ToActionResult(this);
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateMe(UpdateProfileRequest req)
    {
        var result = await _profile.UpdateMyProfileAsync(req);
        // Trước hardcode 404 kể cả khi lỗi là Identity validation (VD FullName quá dài)
        // — người dùng thấy "không tìm thấy" trong khi thật ra dữ liệu gửi lên sai.
        return result.ToActionResult(this);
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

        return result.ToActionResult(this, "Đã cập nhật ảnh đại diện.");
    }


}