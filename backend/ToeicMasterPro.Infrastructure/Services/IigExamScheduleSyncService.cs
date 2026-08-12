using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Application.Common.Options;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Services;

// Gọi API công khai của IIG (GetList), upsert vào ExamSchedule theo ExternalId.
// Job Hangfire (IigExamScheduleSyncJob) sẽ gọi SyncAsync() mỗi 6h — xem Program.cs.
public class IigExamScheduleSyncService : IIigExamScheduleSyncService
{
    private readonly IHttpClientFactory _httpClientFactory; // lấy HttpClient đã đăng ký tên "Iig" (Program.cs)
    private readonly IUnitOfWork _uow;
    private readonly IigOptions _options; // đọc từ appsettings section "Iig": BaseUrl, 2 exam, 3 area...
    private readonly ILogger<IigExamScheduleSyncService> _logger;

    public IigExamScheduleSyncService(
        IHttpClientFactory httpClientFactory,
        IUnitOfWork uow,
        IOptions<IigOptions> options,
        ILogger<IigExamScheduleSyncService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _uow = uow;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SyncAsync()
    {
        var client = _httpClientFactory.CreateClient("Iig");

        // IIG nhận dateTest dạng "từ,đến" (comma), KHÔNG phải 1 ngày đơn — xem bước 1 trong docs 12.
        // Lấy khoảng "hôm nay → hôm nay + DateRangeDays" để không bỏ lỡ lịch xa hơn vài ngày tới.
        var from = DateTime.Today;
        var to = from.AddDays(_options.DateRangeDays);
        var dateRange = $"{from:yyyy-MM-dd},{to:yyyy-MM-dd}";

        int created = 0, updated = 0, failed = 0;

        // 3 khu vực × 2 loại bài thi = 6 tổ hợp, mỗi tổ hợp là 1 vòng gọi API riêng
        // (IIG bắt buộc filter exam + area trong 1 request, không có API "lấy tất cả 1 lần")
        foreach (var exam in _options.Exams)
        {
            foreach (var area in _options.Areas)
            {
                try
                {
                    var (c, u) = await SyncOneComboAsync(client, exam, area, dateRange);
                    created += c;
                    updated += u;
                }
                catch (Exception ex)
                {
                    // QUAN TRỌNG: bắt lỗi ở TỪNG tổ hợp, không throw ra ngoài —
                    // 1 tổ hợp lỗi (VD IIG đổi GUID area) không được làm hỏng 5 tổ hợp còn lại.
                    failed++;
                    _logger.LogError(ex,
                        "Lỗi sync IIG cho exam={ExamName} area={AreaName}",
                        exam.Name, area.Name);
                }
            }
        }

        // Gọi SaveChanges 1 LẦN ở cuối (không gọi trong loop) — EF Core gom hết
        // Add/Update của cả 6 tổ hợp vào 1 transaction, nhanh hơn lưu rải rác nhiều lần.
        await _uow.SaveChangesAsync();
        _logger.LogInformation(
            "IIG sync xong: {Created} mới, {Updated} cập nhật, {Failed} tổ hợp lỗi",
            created, updated, failed);
    }

    // Gọi 1 tổ hợp (exam × area), tự lặp qua hết các trang IIG trả về.
    private async Task<(int Created, int Updated)> SyncOneComboAsync(
        HttpClient client, IigCatalogItem exam, IigCatalogItem area, string dateRange)
    {
        int created = 0, updated = 0;
        int pageIndex = 1;
        int totalPage = 1; // chưa biết thật, tạm gán 1 để vào được vòng do-while lần đầu

        // do-while vì CHƯA BIẾT totalPage trước khi gọi lần đầu — phải gọi rồi mới đọc được
        // totalPage từ response, sau đó mới quyết định có cần gọi thêm trang 2, 3... không.
        // headerQuarterId để TRỐNG có chủ ý — lấy hết mọi văn phòng trong khu vực, không lọc riêng.
        // status=true có chủ ý — chỉ lấy lịch "Đang mở" theo yêu cầu ban đầu.
        do
        {
            var url = $"{_options.BaseUrl}?exam={exam.Id}&area={area.Id}&headerQuarterId=" +
                      $"&status=true&dateTest={dateRange}&lang=vi" +
                      $"&pageIndex={pageIndex}&pageSize={_options.PageSize}";

            var result = await client.GetFromJsonAsync<IigGetListResponse>(url)
                ?? throw new InvalidOperationException("IIG trả về rỗng.");

            totalPage = result.TotalPage;

            foreach (var item in result.Data)
            {
                var isNew = await UpsertAsync(item);
                if (isNew) created++; else updated++;
            }

            pageIndex++;
        } while (pageIndex <= totalPage);

        return (created, updated);
    }

    // Upsert 1 bản ghi: có rồi thì update, chưa có thì insert mới.
    // Trả về true = vừa tạo mới, false = vừa cập nhật (chỉ để đếm số liệu log).
    private async Task<bool> UpsertAsync(IigExamItem item)
    {
        var repo = _uow.Repository<ExamSchedule>();

        // Khóa để nhận diện "đây có phải bản ghi này chưa": (ExternalSource, ExternalId).
        // KHÔNG match theo Title/ExamDate/City — IIG có thể đổi giờ thi/tên mà vẫn là lịch đó.
        // Điều kiện ExternalSource == "IIG" đảm bảo KHÔNG bao giờ đụng vào bản ghi
        // ContentManager nhập tay (những bản ghi đó ExternalId luôn là null).
        var existing = (await repo.FindAsync(e =>
            e.ExternalSource == "IIG" && e.ExternalId == item.Id)).FirstOrDefault();

        var startTime = ParseStartTime(item.TimeTest);
        var endTime = ParseEndTime(item.TimeTest);
        var resultDate = ParseResultDate(item.ResultDate);

        if (existing is not null)
        {
            existing.Title = item.ExamName;
            existing.Location = item.HeadQuarter;
            existing.Address = item.HeadQuarterAddress;
            existing.City = item.Area;
            existing.ExamDate = item.DateTest;
            existing.StartTime = startTime;
            existing.EndTime = endTime;
            existing.IsActive = item.IsOpen; // IIG đổi "Đang mở" ↔ "Đã đóng" thì lần sync sau tự cập nhật
            existing.ResultDate = resultDate;
            existing.SetUpdatedAt();
            repo.Update(existing);
            return false;
        }

        var entity = new ExamSchedule
        {
            ExternalId = item.Id,
            ExternalSource = "IIG",
            Title = item.ExamName,
            Organizer = "IIG",
            Location = item.HeadQuarter,
            Address = item.HeadQuarterAddress,
            City = item.Area,
            ExamDate = item.DateTest,
            StartTime = startTime,
            EndTime = endTime,
            IsActive = item.IsOpen,
            ResultDate = resultDate,
            // IIG không trả 3 field này — để null thay vì 0/DateTime.MinValue
            // (đã đổi ExamSchedule sang nullable cho đúng ở bước 3, FE cũng không hiển thị)
            RegistrationDeadline = null,
            Fee = null,
            AvailableSlots = null
        };
        await repo.AddAsync(entity);
        return true;
    }

    private static TimeSpan ParseStartTime(string timeTest)
    {
        // IIG trả "18:00 - 21:00" (giờ bắt đầu - giờ kết thúc) trong 1 chuỗi —
        // ExamSchedule.StartTime chỉ cần giờ bắt đầu, nên tách lấy phần trước dấu "-".
        var startPart = timeTest.Split('-')[0].Trim();
        return TimeSpan.Parse(startPart);
    }

    private static TimeSpan? ParseEndTime(string timeTest)
    {
        var parts = timeTest.Split('-');
        if (parts.Length < 2) return null;
        return TimeSpan.TryParse(parts[1].Trim(), out var t) ? t : null;
    }

    private static DateTime? ParseResultDate(string? resultDate)
    {
        // IIG trả "dd/MM/yyyy" (VD "27/08/2026") — KHÁC định dạng ISO của dateTest,
        // nên không dùng DateTime thường trong record (sẽ throw lúc deserialize JSON).
        return DateTime.TryParseExact(resultDate, "dd/MM/yyyy",
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var d) ? d : null;
    }

    // 2 record dưới đây CHỈ để deserialize JSON của IIG — không phải DTO của hệ thống mình.
    // Tên field JsonPropertyName phải khớp CHÍNH XÁC key trong response (xem ảnh Postman ban đầu).

    private record IigGetListResponse(
        [property: JsonPropertyName("totalPage")] int TotalPage,
        [property: JsonPropertyName("data")] List<IigExamItem> Data);

    private record IigExamItem(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("examName")] string ExamName,
        [property: JsonPropertyName("headQuarter")] string HeadQuarter,
        [property: JsonPropertyName("headQuarterAddress")] string HeadQuarterAddress,
        [property: JsonPropertyName("area")] string Area,
        [property: JsonPropertyName("dateTest")] DateTime DateTest,
        [property: JsonPropertyName("timeTest")] string TimeTest,
        [property: JsonPropertyName("resultDate")] string? ResultDate,
        [property: JsonPropertyName("isOpen")] bool IsOpen);
}
