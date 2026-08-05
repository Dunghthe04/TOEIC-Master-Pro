using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Domain.Entities;
using ToeicMasterPro.Infrastructure.Persistence;
using System.Text;
using System.Security.Claims;
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
using ToeicMasterPro.Application.Common.Options;
using Microsoft.OpenApi;
//Dùng được các hàm của hangFire
using Hangfire;
//Lưu job vào sqlServer
using Hangfire.SqlServer;
using ToeicMasterPro.API.Jobs;
using Microsoft.AspNetCore.Authorization;



var builder = WebApplication.CreateBuilder(args);
// ── Kiểm tra cấu hình bắt buộc — FAIL FAST ────────────────
// Thiếu cấu hình thì chết NGAY ở đây kèm tên khóa và cách đặt,
// thay vì NullReferenceException ở một dòng không liên quan phía dưới.
static string RequireConfig(IConfiguration config, string key)
    => config[key] is { Length: > 0 } value
        ? value
        : throw new InvalidOperationException(
            $"Thiếu cấu hình '{key}'. " +
            $"Development: dotnet user-secrets set \"{key}\" \"<giá-trị>\" " +
            $"— Production: đặt biến môi trường {key.Replace(":", "__")}");

var connectionString = RequireConfig(builder.Configuration, "ConnectionStrings:DefaultConnection");
var redisConn        = RequireConfig(builder.Configuration, "Redis:ConnectionStrings");

//-Serilog=====================
builder.Host.UseSerilog((context, config) =>
 config.ReadFrom.Configuration(context.Configuration));

// ── Database ──────────────────────────────────────────────
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));   // trước: builder.Configuration.GetConnectionString("DefaultConnection")


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

builder.Services.Configure<ToeicDirectionsOptions>(
    builder.Configuration.GetSection(ToeicDirectionsOptions.SectionName));

//-----------gogle signin--------------
builder.Services.Configure<GoogleAuthSettings>(
    builder.Configuration.GetSection(GoogleAuthSettings.SectionName));

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
// Singleton nhưng đăng ký qua FACTORY (_ =>), không phải instance.
// Khác biệt: instance thì Connect() chạy NGAY lúc dựng DI container — Redis chưa lên
// là app chết lúc boot. Factory thì hoãn tới lần đầu có ai resolve IConnectionMultiplexer.
// Vì ICacheService hiện chưa được inject ở đâu, thực tế Connect() không bao giờ chạy.
// Vẫn là 1 instance duy nhất cho cả app (bản chất Singleton).
builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
    ConnectionMultiplexer.Connect(redisConn));
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
        connectionString,
        new SqlServerStorageOptions
        {
            PrepareSchemaIfNecessary = true // tự tạo schema Hangfire lần đầu
        }));
//Bật background Job server trong process API
builder.Services.AddHangfireServer();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IVocabularyService, VocabularyService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repositories<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ISrsService, SrsService>();
builder.Services.AddScoped<IPracticeService, PracticeService>();
builder.Services.AddScoped<ITestSessionService, TestSessionService>();

var jwt = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
    ?? throw new InvalidOperationException(
        "Thiếu section 'Jwt' trong cấu hình. Xem khung khóa ở appsettings.json.");

// SecretKey: HMAC-SHA256 cần khóa ≥ 256 bit (32 byte). Ngắn hơn → IDX10653 lúc TẠO token,
// nghĩa là app khởi động bình thường rồi mới chết ở request login đầu tiên. Chặn ngay tại đây.
if (Encoding.UTF8.GetByteCount(jwt.SecretKey) < 32)
    throw new InvalidOperationException(
        $"'Jwt:SecretKey' phải dài ít nhất 32 byte (hiện tại: {Encoding.UTF8.GetByteCount(jwt.SecretKey)}). " +
        "Sinh khóa mới: [Convert]::ToBase64String((New-Object byte[] 48)) sau khi fill bằng RandomNumberGenerator. " +
        "Đặt qua user-secrets \"Jwt:SecretKey\" hoặc biến môi trường Jwt__SecretKey.");

if (string.IsNullOrWhiteSpace(jwt.Issuer) || string.IsNullOrWhiteSpace(jwt.Audience))
    throw new InvalidOperationException(
        "Thiếu 'Jwt:Issuer' hoặc 'Jwt:Audience'. Đặt Jwt__Issuer / Jwt__Audience.");

//Đăng ký JwtBear Authentication
builder.Services.AddAuthentication(options =>
{
    //Ghi đè scheme mặc định của Identity (cookie) -> dùng JWT cho API
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(jwtBearerOptions =>
{
    // Giữ claim type gốc — role trong JWT khớp [Authorize(Roles = ...)]
    jwtBearerOptions.MapInboundClaims = false;
    jwtBearerOptions.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer,
        ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SecretKey)),
        ClockSkew = TimeSpan.Zero,
        RoleClaimType = ClaimTypes.Role,
        NameClaimType = ClaimTypes.Name,
    };
});
// ── Authorization: mặc định ĐÓNG ──────────────────────────
// Endpoint không có metadata authorization nào sẽ bị áp policy này.
// mặc định tất cả api đêu phải author, nếu api nào k muốn thì thêm [AllowAnonymous] vào controller hoặc action. Nếu quên [AllowAnonymous] thì 401, nếu quên [Authorize] thì lộ dữ liệu.
// Đổi mô hình từ "quên [Authorize] = lộ dữ liệu" thành "quên [AllowAnonymous] = 401".
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build());


// ── CORS ──────────────────────────────────────────────────
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

// Prod mà rỗng thì WithOrigins() chặn HẾT — frontend chỉ thấy lỗi CORS mờ mịt
// trên console trình duyệt, không có dòng log nào ở server. Chết sớm còn hơn.
if (allowedOrigins.Length == 0 && !builder.Environment.IsDevelopment())
    throw new InvalidOperationException(
        "'Cors:AllowedOrigins' rỗng ở môi trường non-Development. " +
        "Đặt Cors__AllowedOrigins__0=https://ten-mien-cua-ban.com");


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

    // Seed tài khoản theo role (Admin / ContentManager) — chỉ tạo nếu chưa có email
    await SeedUserIfMissingAsync(userManager, config, "AdminSeed", "Admin");
    await SeedUserIfMissingAsync(userManager, config, "ContentManagerSeed", "ContentManager");
}

/// <summary>Tạo user seed từ section config (Email/Password/FullName) nếu chưa tồn tại.</summary>
static async Task SeedUserIfMissingAsync(
    UserManager<ApplicationUser> userManager,
    IConfiguration config,
    string sectionName,
    string role)
{
    var email = config[$"{sectionName}:Email"];
    var password = config[$"{sectionName}:Password"];
    var fullName = config[$"{sectionName}:FullName"];
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
        return;

    if (await userManager.FindByEmailAsync(email) is not null)
        return;

    var user = new ApplicationUser
    {
        UserName = email,
        Email = email,
        FullName = fullName ?? role,
        EmailConfirmed = true
    };
        var result = await userManager.CreateAsync(user, password);
    if (result.Succeeded)
    {
        await userManager.AddToRoleAsync(user, role);
        Log.Information("Đã seed tài khoản {Role}: {Email}", role, email);
    }
    else
    {
        // KHÔNG throw: seed thất bại không nên chặn app khởi động.
        // Nhưng phải LOG — bug cũ là mật khẩu 7 ký tự không thỏa RequiredLength=8
        // và lỗi bị nuốt im lặng, nên tài khoản ContentManager chưa bao giờ được tạo.
        Log.Error("Seed tài khoản {Role} ({Email}) THẤT BẠI: {Errors}",
            role, email, string.Join("; ", result.Errors.Select(e => e.Description)));
    }
}
