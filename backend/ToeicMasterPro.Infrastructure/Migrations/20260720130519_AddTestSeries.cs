using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToeicMasterPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTestSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Series",
                table: "Tests",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Tests_Series",
                table: "Tests",
                column: "Series");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Tests_Series",
                table: "Tests");

            migrationBuilder.DropColumn(
                name: "Series",
                table: "Tests");
        }
    }
}
