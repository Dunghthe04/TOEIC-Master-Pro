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
  DateTime CreatedAt,
  // Frontend cần biết role để lọc menu + điều hướng trang chủ theo vai.
  // Đọc từ DB (không parse JWT) vì Admin gán role mới thì token cũ chưa biết.
  IReadOnlyList<string> Roles
);
