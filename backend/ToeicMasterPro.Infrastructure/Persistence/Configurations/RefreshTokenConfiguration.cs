using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence.Configurations;
public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>{
    public void Configure(EntityTypeBuilder<RefreshToken> builder){
        builder.ToTable("RefreshTokens");
        builder.HasKey(x=>x.Id);
        builder.Property(x=>x.Token).IsRequired().HasMaxLength(200);
        builder.HasIndex(x=>x.Token).IsUnique();
        
        // Bỏ qua property computed
        builder.Ignore(x => x.IsExpired);
        builder.Ignore(x => x.IsActive);

        builder.HasOne(x=> x.User)
        .WithMany()
        .HasForeignKey(x => x.UserId)
        .OnDelete(DeleteBehavior.Cascade);
    }
}