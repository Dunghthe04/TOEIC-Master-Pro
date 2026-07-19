using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.Infrastructure.Services;

// Day 21: chưa cấu SMTP → in ra console để test job
public class ConsoleEmailSender : IEmailSender
{
    public Task SendAsync(string toEmail, string subject, string body)
    {
        Console.WriteLine("========== EMAIL ==========");
        Console.WriteLine($"To     : {toEmail}");
        Console.WriteLine($"Subject: {subject}");
        Console.WriteLine(body);
        Console.WriteLine("===========================");
        return Task.CompletedTask;
    }
}