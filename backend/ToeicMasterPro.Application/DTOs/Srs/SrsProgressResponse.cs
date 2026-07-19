namespace ToeicMasterPro.Application.DTOs.Srs;

public record SrsProgressResponse(
    int TotalTracking,   // tổng từ đang theo dõi
    int DueToday,        // đến hạn ôn hôm nay
    int Learned,         // IsLearned = true
    int Learning         // đang học, chưa IsLearned
);