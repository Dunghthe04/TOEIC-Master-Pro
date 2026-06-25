using System.Text.Json;
using StackExchange.Redis;
using ToeicMasterPro.Application.Common.Interfaces;

namespace ToeicMasterPro.Infrastructure.Caching;

public class RedisCacheService : ICacheService
{
    //Đối tượng thao tác của redis
    private readonly IDatabase _db;

    //Kết nối tới redis server
    public RedisCacheService(IConnectionMultiplexer redis)
    {
        //redis có kiểu ConnectionMultiplexer chứa bộ connection tới redis server, có phương thức GetDatabase()
        //lấy database trong redis để thao tác lưu/lấy dữ liệu
        _db = redis.GetDatabase();
    }

    public async Task<T?> GetAsync<T>(string key, CancellationToken ct = default)
    {
        var value = await _db.StringGetAsync(key);
        //không có key -> trả default (null); có thì parse JSON về object T
        return value.IsNullOrEmpty ? default : JsonSerializer.Deserialize<T>(value!);
    }

    //Lưu value vào cache với key, kèm thời gian sống (expiry); null = vĩnh viễn
    public async Task SetAsync<T>(string key, T value, TimeSpan? expiry = null, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(value);   // object -> JSON string
        await _db.StringSetAsync(key, json, expiry);
    }

    //Xóa key
    public async Task RemoveAsync(string key, CancellationToken ct = default)
    {
        await _db.KeyDeleteAsync(key);
    }

    //Kiểm tra key tồn tại không
    public async Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        return await _db.KeyExistsAsync(key);
    }
}
