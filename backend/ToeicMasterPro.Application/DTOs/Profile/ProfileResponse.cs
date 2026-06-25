namespace ToeicMasterPro.Application.DTOs.Profile;

public record ProfileResponse(
  Guid Id,
  string Email,
  string FullName,
  string? AvatarUrl,
  int TargetScore,
  DateTime? ExamDate,
  string Plan,
  int XpPoints,
  int StreakDays,
  DateTime CreatedAt
);