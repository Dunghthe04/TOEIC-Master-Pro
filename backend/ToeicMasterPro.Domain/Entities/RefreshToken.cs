using ToeicMasterPro.Domain.Common;

namespace ToeicMasterPro.Domain.Entities;

public class RefreshToken : BaseEntity{
    public Guid UserId {get; set;}
    public string Token {get; set;} = string.Empty;
    public DateTime ExpiresAt{get;set;}
    public DateTime? RevokedAt {get; set;}

    //Computed - không map xuống DB
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => RevokedAt is null && !IsExpired;

    public ApplicationUser User { get; set;} = null!;
}