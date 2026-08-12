using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToeicMasterPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEndTimeAndResultDateToExamSchedule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeSpan>(
                name: "EndTime",
                table: "ExamSchedules",
                type: "time",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ResultDate",
                table: "ExamSchedules",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "ExamSchedules");

            migrationBuilder.DropColumn(
                name: "ResultDate",
                table: "ExamSchedules");
        }
    }
}
