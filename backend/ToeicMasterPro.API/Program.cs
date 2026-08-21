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
using Hangfire.Dashboard;                    // LocalRequestsOnlyAuthorizationFilter, DashboardOptions
using ToeicMasterPro.API.Authorization;      // HangfireDashboardAuthFilter (file mình vừa tạo)
using Microsoft.AspNetCore.Mvc;              // ApiBehaviorOptions, BadRequestObjectResult
using Microsoft.AspNetCore.HttpOverrides;    // ForwardedHeadersOptions — đọc IP thật sau Nginx





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

    // Day 48 — lockout khi sai mật khẩu liên tiếp. AllowedForNewUsers mặc định đã
    // là true (không cần set) — UserManager.CreateAsync tự đặt LockoutEnabled=true
    // cho MỌI user tạo qua đó, kể cả user tạo trước khi thêm dòng config này.
    options.Lockout.MaxFailedAccessAttempts = 5;
    options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);

    // Day 48 — chặn đăng nhập bằng mật khẩu nếu email chưa xác thực. Vá lỗ hổng
    // "đăng ký chiếm email người khác": tài khoản tạo bằng email không sở hữu sẽ
    // KHÔNG đăng nhập được (kể cả người tạo nó) tới khi ai đó thật click link xác
    // nhận gửi vào đúng hộp mail đó.
    options.SignIn.RequireConfirmedEmail = true;
})

.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ── JWT Authentication ────────────────────────────────────
builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection(JwtSettings.SectionName));

builder.Services.Configure<ToeicDirectionsOptions>(
    builder.Configuration.GetSection(ToeicDirectionsOptions.SectionName));

builder.Services.Configure<IigOptions>(                              // MỚI
    builder.Configuration.GetSection(IigOptions.SectionName));

//-----------gogle signin--------------
builder.Services.Configure<GoogleAuthSettings>(
    builder.Configuration.GetSection(GoogleAuthSettings.SectionName));

builder.Services.Configure<SmtpSettings>(
    builder.Configuration.GetSection(SmtpSettings.SectionName));

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
builder.Services.AddHttpClient("Iig", client =>            // MỚI
{
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();
builder.Services.AddScoped<ExamReminderJob>();
builder.Services.AddScoped<IigExamScheduleSyncJob>();
builder.Services.AddScoped<IIigExamScheduleSyncService, IigExamScheduleSyncService>();
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
builder.Services.AddSingleton<MediaPathProvider>();
builder.Services.AddSingleton<HtmlContentSanitizer>();
builder.Services.AddSingleton<MediaTokenService>();
builder.Services.AddScoped<IVocabularyService, VocabularyService>();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repositories<>));
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped<ISrsService, SrsService>();
builder.Services.AddScoped<IPracticeService, PracticeService>();
builder.Services.AddScoped<ITestSessionService, TestSessionService>();
builder.Services.AddScoped<IAuditLogger, AuditLogger>();

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

    // Mặc định rate limiter trả 429 với BODY RỖNG. Frontend đọc `err.response.data.error`
    // nên nhận undefined → rơi xuống câu mặc định "Đăng nhập thất bại, thử lại sau" —
    // user đọc thành "sai mật khẩu" và cứ thử tiếp, càng thử càng bị chặn lâu.
    // Trả JSON ĐÚNG HÌNH DẠNG { error } mà toàn bộ API đang dùng thì mọi màn hình hiện
    // đúng thông báo mà không phải sửa gì thêm ở client.
    options.OnRejected = async (context, ct) =>
    {
        // ĐO THỰC TẾ 2026-08-08: với FixedWindowRateLimiter, MetadataName.RetryAfter trả
        // ĐỘ DÀI CỬA SỔ (luôn 60), KHÔNG phải thời gian còn lại. Lấy mẫu mỗi 5 giây thấy
        // nó đứng yên ở 60 suốt rồi cửa sổ reset:
        //     t=5s → 60 · t=25s → 60 · t=30s → hết chặn
        // Nên đây là CẬN TRÊN, không phải số giây chính xác. Header Retry-After hiểu theo
        // nghĩa cận trên là đúng chuẩn HTTP, giữ nguyên.
        var retryAfter = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var wait)
            ? (int)Math.Ceiling(wait.TotalSeconds)
            : 60;

        // Header chuẩn HTTP — để client/proxy tự động biết chờ bao lâu, không phải parse chuỗi
        context.HttpContext.Response.Headers.RetryAfter = retryAfter.ToString();
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            // "TỐI ĐA" chứ không phải "sau N giây": ở giây thứ 25 của cửa sổ thì thực tế chỉ
            // còn ~5 giây, hứa đúng 60 là sai. Một con số trông chính xác mà sai thì tệ hơn
            // một ước lượng thành thật — user chờ thừa rồi kết luận thông báo không đáng tin.
            error = $"Bạn thao tác quá nhanh. Vui lòng chờ tối đa {retryAfter} giây rồi thử lại."
        }, ct);
    };

    //Chính sách "auth" tối đa 5 request/ phút/ mỗi địa chỉ IP
    //Dành cho các endpoint ĐOÁN ĐƯỢC bí mật: login, register, forgot/reset password,
    //google-login. Ở đây 5/phút mới có ý nghĩa — nó làm brute-force mật khẩu bất khả thi.
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

    // Chính sách "auth-refresh" — cho refresh-token và logout.
    //
    // VÌ SAO PHẢI TÁCH: hai nhóm endpoint này có mô hình đe dọa KHÁC HẲN nhau, nên
    // không thể dùng chung một hạn mức.
    //   · login  → kẻ tấn công ĐOÁN được mật khẩu, nên hạn mức phải chặt.
    //   · refresh-token → phải cầm sẵn refresh token 64 byte ngẫu nhiên mới gọi được
    //     gì có ý nghĩa; đoán mò là bất khả thi nên siết chặt KHÔNG thêm an toàn.
    //
    // Trước đây [EnableRateLimiting("auth")] đặt ở cấp class nên refresh-token dùng
    // chung quota 5/phút với login. Hậu quả thật đã gặp: user F5 vài lần là hết quota,
    // server trả 429, frontend hiểu nhầm thành "hết phiên" và đá về /login — tức là
    // rate limit tự biến thành lỗi đăng xuất ngẫu nhiên, trong khi token vẫn còn tốt.
    // 30/phút đủ chỗ cho F5 liên tục và nhiều tab, vẫn chặn được vòng lặp hỏng.
    options.AddPolicy("auth-refresh", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
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

// ── Lỗi validation trả về cùng KHUÔN với mọi lỗi khác của app ──────────
// Mặc định [ApiController] trả ValidationProblemDetails: { type, title, status,
// errors: { Email: ["..."] } }. Nhưng toàn bộ frontend đọc lỗi bằng
// err.response?.data?.error (khuôn { error } mà các controller tự trả). Đã grep:
// KHÔNG chỗ nào ở frontend đọc .errors hay .title của ProblemDetails.
// → Không có dòng này thì mọi lỗi DataAnnotations hiện ra UI thành câu fallback
//   vô nghĩa kiểu "Đăng ký thất bại, thử lại sau.", tức là thêm annotation xong
//   vẫn không ai đọc được nó nói gì.
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var message = string.Join("; ", context.ModelState
            .Where(kv => kv.Value is not null && kv.Value.Errors.Count > 0)
            .SelectMany(kv => kv.Value!.Errors.Select(e => e.ErrorMessage))
            .Where(m => !string.IsNullOrWhiteSpace(m)));

        // Fallback khi ModelState lỗi nhưng không có message đọc được (VD JSON dị
        // dạng, sai kiểu dữ liệu) — thông báo mặc định của .NET là tiếng Anh và có
        // thể lộ tên kiểu nội bộ, nên thay bằng câu chung.
        return new BadRequestObjectResult(new
        {
            error = string.IsNullOrWhiteSpace(message) ? "Dữ liệu gửi lên không hợp lệ." : message
        });
    };
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

// ── Forwarded headers — PHẢI đứng TRƯỚC mọi middleware khác ─────────────
//
// Sau reverse proxy (Nginx ở Phase 3), Kestrel thấy IP của proxy chứ không phải của
// client → Connection.RemoteIpAddress là 127.0.0.1 cho MỌI request, và cột IpAddress
// trong AuditLogs thành vô dụng. UseHttpsRedirection cũng sai vì proxy nói chuyện HTTP
// với Kestrel dù client đang dùng HTTPS.
//
// Middleware này đọc X-Forwarded-For / X-Forwarded-Proto do proxy đặt rồi ghi lại
// RemoteIpAddress và Request.Scheme. Phải đứng đầu chuỗi: middleware nào chạy trước nó
// vẫn thấy giá trị cũ.
//
// ⚠️ KnownNetworks/KnownProxies bị XOÁ SẠCH là CỐ Ý và chỉ an toàn vì Nginx là chặng
// duy nhất trước Kestrel (cùng docker network, Kestrel không mở ra ngoài). Header này do
// client gửi nên giả mạo được — nếu Kestrel nhận request trực tiếp từ Internet, kẻ tấn
// công tự đặt X-Forwarded-For để ghi IP giả vào log. Mặc định .NET chỉ tin loopback, mà
// trong Docker thì Nginx có IP khác nên phải mở; đánh đổi này chỉ đúng khi Kestrel KHÔNG
// bao giờ nhận request trực tiếp.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    ForwardLimit = 1,   // chỉ một chặng proxy (Nginx) — không nhận chuỗi X-Forwarded-For dài
    KnownNetworks = { },
    KnownProxies = { },
});

// ── Seed Data ─────────────────────────────────────────────
await SeedAsync(app);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    // .AllowAnonymous() BẮT BUỘC: MapScalarApiReference tạo ENDPOINT nên fallback policy
    // áp lên nó → /scalar trả 401. Còn UseSwagger/UseSwaggerUI ở trên là MIDDLEWARE, không
    // có endpoint metadata nên fallback policy không với tới → vẫn mở bình thường.
    // Cùng một trang tài liệu, hai kết cục khác nhau chỉ vì middleware vs endpoint.
    app.MapScalarApiReference(options =>
    {
        options.OpenApiRoutePattern = "/swagger/v1/swagger.json";
        options.Title = "ToeicMasterPro API";
    }).AllowAnonymous();
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
// Chỉ phục vụ wwwroot = avatar (thật sự công khai).
// Audio/ảnh đề thi nằm ở protected-media/ NGOÀI wwwroot, serve qua MediaFileController
// có [Authorize] — vì static file middleware là terminal, không tham gia authorization.
app.UseStaticFiles();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();
app.MapControllers();
// ── Hangfire Dashboard ────────────────────────────────────
// Dùng MapHangfireDashboard (KHÔNG dùng UseHangfireDashboard): bản Map đăng ký dashboard
// như một ENDPOINT nên gọi được .AllowAnonymous(); bản Use trả IApplicationBuilder,
// không có method đó (CS0311).
//
// HAI TẦNG AUTHORIZATION ĐỘC LẬP — hiểu sai chỗ này là hoặc 401 vĩnh viễn, hoặc mở toang:
//   Tầng 1 — fallback policy ASP.NET Core: đòi JWT trong header Authorization: Bearer.
//            .AllowAnonymous() GỠ tầng này. Bắt buộc phải gỡ, vì dashboard là trang HTML
//            mở bằng trình duyệt, mà access token nằm trong localStorage của app React
//            nên trình duyệt KHÔNG tự gắn header → không gỡ thì chính mình cũng 401.
//   Tầng 2 — DashboardOptions.Authorization: filter riêng của Hangfire. ĐÂY là chỗ chặn thật.
//
// Đọc header response để biết bị chặn ở tầng nào:
//   WWW-Authenticate: Bearer  → tầng 1 chặn, filter chưa hề chạy
//   WWW-Authenticate: Basic   → tầng 2 chặn, đúng như thiết kế
//
// PHẢI đặt sau UseAuthentication để HttpContext.User đã được điền từ JWT (nhánh a của filter).
var hangfireUser = builder.Configuration["Hangfire:DashboardUser"];
var hangfirePass = builder.Configuration["Hangfire:DashboardPassword"];

if (app.Environment.IsDevelopment())
{
    // Dev: mở tự do. Kestrel chỉ bind localhost nên máy ngoài không tới được.
    //
    // KHÔNG dùng LocalRequestsOnlyAuthorizationFilter: nó so sánh RemoteIpAddress với
    // 127.0.0.1, mà trình duyệt gọi "localhost" ra ::1 (IPv6) → từ chối ngay trên máy
    // mình. Và khi deploy sau Nginx thì MỌI request đến từ mạng nội bộ Docker nên nó
    // trông như cho qua hết. Xác thực theo IP sai ở cả hai đầu — đó là lý do Production
    // dùng filter theo DANH TÍNH ở khối dưới.
    //
    // Mảng rỗng = tường minh KHÔNG filter. Khác với việc không truyền DashboardOptions
    // (Hangfire sẽ tự áp LocalRequestsOnlyAuthorizationFilter).
    app.MapHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = []
    }).AllowAnonymous();
}
else if (!string.IsNullOrWhiteSpace(hangfireUser) && !string.IsNullOrWhiteSpace(hangfirePass))
{
    app.MapHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = [new HangfireDashboardAuthFilter(hangfireUser, hangfirePass)],
        // Chặn Trigger now / Delete / Requeue trên production.
        // Xem thì được, tác động vào job thật thì không — một cú bấm nhầm
        // trên ExamReminderJob là gửi email hàng loạt tới user thật.
        IsReadOnlyFunc = _ => true
    }).AllowAnonymous();
}
// Không cấu hình credential ở Production → KHÔNG mount dashboard.
// Fail closed: thà không có dashboard hơn là có một dashboard mở.

// ── Đăng ký job chạy theo lịch ────────────────────────────
// Dùng IRecurringJobManager lấy từ DI, KHÔNG dùng static RecurringJob.AddOrUpdate.
//
// Vì sao: API static đọc JobStorage.Current — một biến static toàn cục chỉ được set
// như SIDE EFFECT của UseHangfireDashboard. Sau khi chuyển sang MapHangfireDashboard,
// side effect đó mất, và ở Production khối else-if còn có thể KHÔNG chạy (thiếu credential)
// → JobStorage.Current chưa set → "Current JobStorage instance has not been initialized yet".
//
// Tức là việc đăng ký job đang phụ thuộc vào việc dashboard có được mount hay không.
// Đó là coupling sai: job nhắc lịch thi phải chạy độc lập với trang quản trị.

// Cron của Hangfire mặc định hiểu theo UTC (RecurringJobOptions.TimeZone = Utc).
// Không truyền TimeZone thì "30 0 * * *" là 00:30 UTC = 07:30 giờ VN — lệch 7 tiếng
// so với ý định "gửi mail lúc đêm để sáng user mở hộp thư đã thấy".
var vietnamTimeZone = ResolveVietnamTimeZone();
var jobOptions = new RecurringJobOptions { TimeZone = vietnamTimeZone };

using (var jobScope = app.Services.CreateScope())
{
    var recurringJobs = jobScope.ServiceProvider.GetRequiredService<IRecurringJobManager>();

    // 07:00 giờ VN — mail nằm gần đầu hộp thư khi user mở điện thoại buổi sáng.
    // Trước đó là 00:30: lúc đó user đang ngủ, sáng ra mail đã bị đẩy xuống dưới
    // bởi mail đêm khác, mất tác dụng "nhắc".
    recurringJobs.AddOrUpdate<ExamReminderJob>(
        "exam-reminder-email",
        job => job.RunAsync(),
        "0 7 * * *",   // cron 5 phần: PHÚT giờ ngày tháng thứ → phút 0, giờ 7
        jobOptions);

    // Mỗi 3 giờ (0,3,6,...,21) — lịch thi là dữ liệu BÊN NGOÀI, IIG cập nhật bất kỳ
    // lúc nào nên quét dày hơn để kỳ thi mới xuất hiện sớm. 8 lần/ngày thay vì 4.
    recurringJobs.AddOrUpdate<IigExamScheduleSyncJob>(
        "iig-exam-schedule-sync",
        job => job.RunAsync(),
        "0 */3 * * *",   // phút 0 của các giờ chia hết cho 3 — theo giờ VN
        jobOptions);
}


app.Run();

/// <summary>
/// Múi giờ VN có HAI ID khác nhau tùy hệ điều hành, hardcode một cái là vỡ ở phía kia:
///   Windows (máy dev)     → "SE Asia Standard Time"
///   Linux   (Docker prod) → "Asia/Ho_Chi_Minh"
///
/// .NET 8 dùng ICU nên thường nhận cả hai ID trên mọi nền tảng, NHƯNG chỉ khi ICU có
/// mặt — image Alpine hoặc app bật InvariantGlobalization thì không. Nên thử lần lượt
/// thay vì tin vào một ID duy nhất.
///
/// Không tìm được cả hai: fallback UTC+7 tự dựng. VN không có giờ mùa hè (DST) nên
/// offset cố định, cách này an toàn — với múi giờ CÓ DST thì tự dựng sẽ sai.
/// </summary>
static TimeZoneInfo ResolveVietnamTimeZone()
{
    foreach (var id in new[] { "SE Asia Standard Time", "Asia/Ho_Chi_Minh" })
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch (TimeZoneNotFoundException) { }
        catch (InvalidTimeZoneException) { }
    }

    return TimeZoneInfo.CreateCustomTimeZone("VN+7", TimeSpan.FromHours(7), "Vietnam (UTC+7)", "ICT");
}

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
