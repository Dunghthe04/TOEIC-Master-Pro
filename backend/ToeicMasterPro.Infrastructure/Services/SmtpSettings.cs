namespace ToeicMasterPro.Infrastructure.Services;

// Bind từ appsettings section "Smtp". Password KHÔNG nằm trong appsettings —
// đặt qua user-secrets (dev) / biến môi trường Smtp__Password (production),
// giống quy ước Jwt:SecretKey, DB password... (Day 40).
public class SmtpSettings
{
    public const string SectionName = "Smtp";

    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = "TOEIC Master Pro";
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
