namespace ToeicMasterPro.Application.DTOs.Tests;

public record UpdateTestRequest(
    string Title,
    string? Description,
    int DurationMinutes,
    bool IsPublished
);