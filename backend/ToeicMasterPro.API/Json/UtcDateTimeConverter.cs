using System.Text.Json;
using System.Text.Json.Serialization;

namespace ToeicMasterPro.API.Json;

/// <summary>
/// Luôn ghi DateTime ra JSON kèm hậu tố "Z".
///
/// VÌ SAO CẦN: cột datetime2 của SQL Server không lưu offset, nên EF Core đọc về luôn cho
/// Kind = Unspecified dù mọi chỗ trong app đều GHI bằng DateTime.UtcNow. System.Text.Json
/// thấy Unspecified thì ghi "2026-08-22T07:47:12" KHÔNG có "Z", mà chuỗi ISO thiếu múi giờ
/// thì new Date() bên JavaScript hiểu là giờ ĐỊA PHƯƠNG — mọi mốc thời gian trên UI lệch
/// đúng bằng chênh múi giờ (7 tiếng ở VN).
///
/// Trước đây từng vá bằng cách tự thêm "Z" ở frontend, nhưng phải nhớ làm cho từng trang
/// nên trang nào quên là lệch giờ trở lại. Đặt ở đây thì hợp đồng của API rõ ràng: mốc
/// thời gian trả ra luôn là UTC và luôn nói rõ đó là UTC.
///
/// CHỈ can thiệp lúc GHI. Lúc đọc giữ nguyên hành vi mặc định, vì không phải DateTime nào
/// client gửi lên cũng là mốc UTC — ngày dự thi người dùng chọn trên date picker là ngày
/// theo lịch, gán thêm múi giờ cho nó sẽ làm sai ý nghĩa.
/// </summary>
public class UtcDateTimeConverter : JsonConverter<DateTime>
{
    public override DateTime Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime value, JsonSerializerOptions options)
        => writer.WriteStringValue(AsUtc(value));

    /// <summary>
    /// Unspecified được coi là UTC — đúng với quy ước của app: mọi cột thời điểm đều ghi
    /// bằng DateTime.UtcNow hoặc GETUTCDATE().
    /// </summary>
    internal static DateTime AsUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
    };
}

/// <summary>
/// Bản cho DateTime? — System.Text.Json không tự áp converter của DateTime lên kiểu nullable.
/// </summary>
public class NullableUtcDateTimeConverter : JsonConverter<DateTime?>
{
    public override DateTime? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        => reader.TokenType == JsonTokenType.Null ? null : reader.GetDateTime();

    public override void Write(Utf8JsonWriter writer, DateTime? value, JsonSerializerOptions options)
    {
        if (value is null)
            writer.WriteNullValue();
        else
            writer.WriteStringValue(UtcDateTimeConverter.AsUtc(value.Value));
    }
}
