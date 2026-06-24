namespace ToeicMasterPro.Application.DTOs.Auth;

public record RegisterRequest(
    string Email,
    string Password,
    string FullName
);