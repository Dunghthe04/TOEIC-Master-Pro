//File đăng nhập bằng gg
namespace ToeicMasterPro.Infrastructure.Authentication;
public class GoogleAuthSettings{
    //Mục đích của lớp này để đọc config google trong appsettings
    public const string SectionName ="GoogleAuth";
    public string ClientId{get;set;}=string.Empty;
}