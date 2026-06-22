//Tạo, đọc, validate token
using System.IdentityModel.Tokens.Jwt;
//Claim = thông tin được nhét vào token.
using System.Security.Claims;
//Dùng tạo chuỗi ngẫu nhiên bảo mật cao.
using System.Security.Cryptography;
using System.Text;
//Cho phép đọc cấu hình từ appsettings
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Domain.Entities;
namespace ToeicMasterPro.Infrastructure.Authentication;

public class TokenService : ITokenService{
    private readonly JwtSettings _settings;

    public TokenService(IOptions<JwtSettings> options) {
        _settings = options.Value;
    }

    public string GenerateAccessToken(ApplicationUser user, IEnumerable<string> roles){
        //Thông tin tạo token
        var claims = new List<Claim>{
            new (JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new (JwtRegisteredClaimNames.Email, user.Email!),
            //JWT ID., mỗi token có id riêng
            new (JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            //Claims tự định nghĩa (custom claims)
            new("fullname",user.FullName),
        };
        //Thêm role vào claims
        claims.AddRange(roles.Select(r=> new Claim(ClaimTypes.Role, r)));

        //Tạo scretKey từ SecretKy appsettings-> chuyển về dạng byte[]
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_settings.SecretKey)
        );
       //Tạo thông tin ký
       var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
       //Tạo token: 
       // issuer: ai phát hành token
       // audience: nơi sẽ dùng token
       // claims: thông tin chứa trong token
       // expires: thời gian hết hạn
       // signingCredentials: thông tin ký
       var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.AccessTokenExpiryMinutes),
            signingCredentials: creds);

        //tạo ra token dạng Head.payload.signature
        return new JwtSecurityTokenHandler().WriteToken(token);

    }

    //Tạo Refresh token
     public RefreshToken GenerateRefreshToken(Guid userId) => new()
    {
        UserId = userId,
        Token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64)),
        ExpiresAt = DateTime.UtcNow.AddDays(_settings.RefreshTokenExpiryDays),
    };
}