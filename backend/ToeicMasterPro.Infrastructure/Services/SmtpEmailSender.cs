using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;
using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.Infrastructure.Services;

// Thay ConsoleEmailSender khi có SMTP thật — gửi qua Gmail SMTP bằng MailKit
// (KHÔNG dùng System.Net.Mail — Microsoft khuyến cáo không dùng cho code mới).
public class SmtpEmailSender : IEmailSender
{
    private readonly SmtpSettings _settings;

    public SmtpEmailSender(IOptions<SmtpSettings> options)
    {
        _settings = options.Value;
    }

    public async Task SendAsync(string toEmail, string subject, string body)
    {
        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(toEmail));
        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient();
        // StartTls: kết nối trần rồi nâng cấp lên TLS — đúng cách Gmail SMTP port 587 yêu cầu.
        await client.ConnectAsync(_settings.Host, _settings.Port, SecureSocketOptions.StartTls);
        // Username/Password ở đây là email + APP PASSWORD 16 ký tự của Google,
        // KHÔNG phải mật khẩu đăng nhập Gmail thật.
        await client.AuthenticateAsync(_settings.Username, _settings.Password);
        await client.SendAsync(message);
        await client.DisconnectAsync(quit: true);
    }
}
