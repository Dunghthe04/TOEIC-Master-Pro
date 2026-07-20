namespace ToeicMasterPro.Application.Common.Options;

// Bind từ appsettings section "ToeicDirections"
public class ToeicDirectionsOptions
{
    public const string SectionName = "ToeicDirections";

    // Key: "1".."7" tương ứng QuestionPart
    public Dictionary<string, PartDirectionConfig> Parts { get; set; } = new();
}

public class PartDirectionConfig
{
    // Ảnh Directions cố định (mọi đề giống nhau) — FE public/exam/directions/
    public string ImageUrl { get; set; } = string.Empty;
    // Listening Part 1–4: audio intro; Reading = null
    public string? AudioUrl { get; set; }
}
