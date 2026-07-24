using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToeicMasterPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTestSessionPartsFilter : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PartsFilter",
                table: "TestSessions",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PartsFilter",
                table: "TestSessions");
        }
    }
}
