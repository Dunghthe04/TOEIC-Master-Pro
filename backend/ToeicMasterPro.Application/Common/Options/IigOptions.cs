namespace ToeicMasterPro.Application.Common.Options;

// Bind từ appsettings section "Iig"
public class IigOptions
{
    public const string SectionName = "Iig";

    public string BaseUrl { get; set; } = string.Empty;
    public int PageSize { get; set; } = 50;
    public int DateRangeDays { get; set; } = 60;
    public List<IigCatalogItem> Exams { get; set; } = new();
    public List<IigCatalogItem> Areas { get; set; } = new();
}

public class IigCatalogItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
}
