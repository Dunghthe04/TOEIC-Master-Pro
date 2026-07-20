namespace ToeicMasterPro.Application.DTOs.Tests;

//Mục đích : Dữ liệu dùng khi tạo đề thi mới
public record CreateTestRequest(
    string Title,
    string? Description,
    int DurationMinutes,
    bool IsPublished,
    string? Series
);