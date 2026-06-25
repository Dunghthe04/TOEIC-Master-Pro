namespace ToeicMasterPro.Application.DTOs.Profile;

public record UpdateProfileRequest(
    string FullName,
    int TargetScore,
    DateTime? ExamDate
);