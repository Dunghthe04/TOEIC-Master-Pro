using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Infrastructure.Authentication;
using ToeicMasterPro.Infrastructure.Services;
using System.Threading.RateLimiting;
using ToeicMasterPro.API.Services;
using StackExchange.Redis;
using ToeicMasterPro.Infrastructure.Caching;
using ToeicMasterPro.Infrastructure.Persistence.Repositories;
using ToeicMasterPro.API.Middleware;
using Serilog;
using Scalar.AspNetCore;
using Microsoft.OpenApi;
//Dùng được các hàm của hangFire
using Hangfire;
//Lưu job vào sqlServer
using Hangfire.SqlServer;
using ToeicMasterPro.API.Jobs;


var builder = WebApplication.CreateBuilder(args);
//-Serilog=====================
builder.Host.UseSerilog((context, config) =>
 config.ReadFrom.Configuration(context.Configuration));

// ── Database ──────────────────────────────────────────────
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── Identity ──────────────────────────────────────────────
builder.Services.AddIdentity<ApplicationUser, IdentityRole<Guid>>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireUppercase = true;
    options.Password.RequireNonAlphanumeric = true;
    options.User.RequireUniqueEmail = true;
})

.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ────────────────────────────────────
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection(JwtSettings.SectionName));

//-----------gogle signin--------------
builder.Services.Configure<GoogleAuthSettings>(
    builder.Configuration.GetSection(GoogleAuthSettings.SectionName));

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
var redisConn = builder.Configuration["Redis:ConnectionStrings"]!;
//Chỗ nào gọi IConnectionMultiplexer thì dùng chung cái này, trả về 1 instant 
builder.Services.AddSingleton<IConnectionMultiplexer>(ConnectionMultiplexer.Connect(redisConn));
builder.Services.AddScoped<ICacheService, RedisCacheService>();
builder.Services.AddScoped<IProfileService, ProfileService>();
builder.Services.AddScoped<IQuestionService, QuestionService>();
builder.Services.AddScoped<ITestService, TestService>();
builder.Services.AddScoped<IExamScheduleService, ExamScheduleService>();
builder.Services.AddScoped<IExamReminderService, ExamReminderService>();
builder.Services.AddScoped<IEmailSender, ConsoleEmailSender>();
builder.Services.AddScoped<ExamReminderJob>();
// Đăng ký Hangfire vào DI và lưu job ở cũng SQLServer, rồi bật worker chạy job
builder.Services.AddHangfire(config => config
    //Chọn phiên bản dữ liệu Hangfire lưu vào db
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    //Khi lưu job, Hangfire ghi tên class sẽ chạy
    .UseSimpleAssemblyNameTypeSerializer()
    //Cấu hình JSON serializer (Newtonsoft) theo khuyến nghị Hangfire khi serialize tham số job.
    .UseRecommendedSerializerSettings()
    //Cất job ở sqlver dùng chung ==> tạo bảng Hangfire.jo, Hangfire.State,...
    .UseSqlServerStorage(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        new SqlServerStorageOptions
        {
            PrepareSchemaIfNecessary = true // tự tạo schema Hangfire lần đầu
        }));
//Bật background Job server trong process API
builder.Services.AddHangfireServer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repositories<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();

var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!;

//Đăng ký JwtBear Authentication
builder.Services.AddAuthentication(options =>
{
    //Ghi đè scheme mặc định của Identity (cookie) -> dùng JWT cho API
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(jwtBearerOptions =>
{
    jwtBearerOptions.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey)),
        ClockSkew = TimeSpan.Zero   // bỏ 5 phút dung sai mặc định
    };
});

// ── CORS ──────────────────────────────────────────────────
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ── Rate limiting ─────────────────────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    //Chính sách "auth" tối đa 5 request/ phút/ mỗi địa chỉ IP
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            //lấy ip của client
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                // Cho phép 5 request trong 1 phút
                PermitLimit = 5,
                // Reset mỗi 1 phút
                Window = TimeSpan.FromMinutes(1),
                // Không cho vào hàng đợi, từ chối ngay lập tức nếu hết quota
                QueueLimit = 0
            }

        )
    );
});

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddHttpContextAccessor();
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "ToeicMasterPro API",
        Version = "v1"
    });

    c.AddServer(new OpenApiServer
    {
        Url = "https://localhost:7021"
    });
});


var app = builder.Build();

// ── Seed Data ─────────────────────────────────────────────
await SeedAsync(app);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapScalarApiReference(options =>
{
    options.OpenApiRoutePattern = "/swagger/v1/swagger.json";
    options.Title = "ToeicMasterPro API";
});
}
//ExceptionHandler phải nằm trước Authentication, Authorization và Routing
app.UseExceptionHandler();
app.UseSerilogRequestLogging();   // ← THÊM: log mỗi request vào: method, path, status, time
// Dev: FE gọi http://localhost:5191 — bật HTTPS redirect sẽ 307 sang https://localhost:7021
// → trình duyệt chặn cert tự ký, request không vào được /api/auth/login
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseStaticFiles();        // ← THÊM: phục vụ wwwroot (ảnh avatar tại /uploads/avatars/...)
app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
app.UseHangfireDashboard("/hangfire"); // Dev xem job: http://localhost:5191/hangfire
//Đăng ký or cập nhập, job chạy theo lịch
RecurringJob.AddOrUpdate<ExamReminderJob>(
    "exam-reminder-email",//id
    job => job.RunAsync(),// cứ đúng hẹn nó chạy hàm này
    "30 0 * * *"); // cron 5 phần: phút giờ ngày tháng thứ — 00:30 mỗi ngày, * ngày, *tháng, * thứ
app.Run();

// ── Seed Method ───────────────────────────────────────────
static async Task SeedAsync(WebApplication app)
{
    using var scope = app.Services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();

    // Seed Roles
    string[] roles = ["Admin", "ContentManager", "User"];
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole<Guid>(role));
    }

    // Seed Admin account
    var adminEmail = config["AdminSeed:Email"]!;
    if (await userManager.FindByEmailAsync(adminEmail) is null)
    {
        var admin = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            FullName = config["AdminSeed:FullName"]!,
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(admin, config["AdminSeed:Password"]!);
        if (result.Succeeded)
            await userManager.AddToRoleAsync(admin, "Admin");
    }
}