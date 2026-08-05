using System.Reflection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace ToeicMasterPro.Infrastructure.Persistence;

// Chỉ dùng lúc chạy dotnet ef migrations — không ảnh hưởng runtime.
// dotnet ef chạy NGOÀI app nên không thừa hưởng cấu hình từ Program.cs:
// phải tự nạp lại đúng thứ tự nguồn mà app dùng.
public class ApplicationDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        // Đứng ở thư mục nào cũng ra đúng đường dẫn API — trước đây phụ thuộc
        // GetCurrentDirectory() nên chạy từ thư mục gốc repo là sai base path.
        var assemblyDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location)!;
        var apiPath = Path.GetFullPath(Path.Combine(
            assemblyDir, "..", "..", "..", "..", "ToeicMasterPro.API"));

        var config = new ConfigurationBuilder()
            .SetBasePath(apiPath)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            // Secret không nằm trong file JSON nữa — Development đọc từ User Secrets
            // (%APPDATA%\Microsoft\UserSecrets\<UserSecretsId>), Production từ biến môi trường.
            .AddUserSecrets<ApplicationDbContextFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString = config.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
            throw new InvalidOperationException(
                "Thiếu 'ConnectionStrings:DefaultConnection' lúc design-time. " +
                "Đặt qua: dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"<giá-trị>\" " +
                "--project backend/ToeicMasterPro.API " +
                "— hoặc biến môi trường ConnectionStrings__DefaultConnection.");

        var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();
        optionsBuilder.UseSqlServer(connectionString);

        return new ApplicationDbContext(optionsBuilder.Options);
    }
}
