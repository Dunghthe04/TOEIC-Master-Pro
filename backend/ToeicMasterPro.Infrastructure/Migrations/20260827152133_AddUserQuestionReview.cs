using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ToeicMasterPro.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserQuestionReview : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserQuestionReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    QuestionId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    WrongCount = table.Column<int>(type: "int", nullable: false),
                    CorrectStreak = table.Column<int>(type: "int", nullable: false),
                    IsResolved = table.Column<bool>(type: "bit", nullable: false),
                    LastWrongAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserQuestionReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserQuestionReviews_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserQuestionReviews_Questions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "Questions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserQuestionReviews_QuestionId",
                table: "UserQuestionReviews",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_UserQuestionReviews_UserId_IsResolved_LastWrongAt",
                table: "UserQuestionReviews",
                columns: new[] { "UserId", "IsResolved", "LastWrongAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserQuestionReviews_UserId_QuestionId",
                table: "UserQuestionReviews",
                columns: new[] { "UserId", "QuestionId" },
                unique: true);

            // ── NẠP DỮ LIỆU BAN ĐẦU TỪ LỊCH SỬ ĐÃ CÓ ──
            //
            // 🔴 KHÔNG BỎ QUA BƯỚC NÀY. Không nạp thì sổ tay rỗng trơn với MỌI người dùng
            // hiện tại, và chỉ đầy dần từ lần thi tiếp theo. Một tính năng ra mắt trong
            // trạng thái rỗng thì người dùng mở một lần rồi không mở lại — đúng số phận của
            // màn "Luyện nhanh" nó đang thay thế (0 phiên sau nhiều tháng).
            //
            // Dữ liệu đã có sẵn: 2.300 dòng trong TestSessionAnswers.
            //
            // Quy tắc nạp, khớp đúng với quy tắc ghi lúc chạy:
            //   · chỉ lấy phiên ĐÃ NỘP (TestSessionStatus.Completed = 2, KHÔNG phải 1 —
            //     enum bắt đầu từ 1 nên InProgress mới là 1)
            //   · mỗi (user, câu) lấy LẦN LÀM GẦN NHẤT — làm lại đề cũ và sửa được thì
            //     câu đó không còn là lỗi sai
            //   · chỉ tính câu ĐÃ CHỌN mà chọn sai; câu bỏ trống KHÔNG vào sổ tay
            //   · WrongCount đếm tổng số lần sai trong toàn bộ lịch sử, không chỉ lần cuối
            //
            // Viết bằng SQL thô chứ không qua EF: đây là một phép gom trên vài nghìn dòng,
            // để EF nạp hết vào bộ nhớ rồi ghi lại từng dòng là chậm hơn nhiều lần mà không
            // được gì.
            migrationBuilder.Sql("""
                WITH LanCuoi AS (
                    SELECT
                        s.UserId,
                        a.QuestionId,
                        a.SelectedOptionId,
                        a.IsCorrect,
                        ISNULL(s.CompletedAt, s.StartedAt) AS LucLam,
                        ROW_NUMBER() OVER (
                            PARTITION BY s.UserId, a.QuestionId
                            ORDER BY ISNULL(s.CompletedAt, s.StartedAt) DESC
                        ) AS Hang
                    FROM TestSessionAnswers a
                    JOIN TestSessions s ON s.Id = a.SessionId
                    WHERE s.Status = 2
                ),
                TongSoLanSai AS (
                    SELECT s.UserId, a.QuestionId, COUNT(*) AS SoLanSai
                    FROM TestSessionAnswers a
                    JOIN TestSessions s ON s.Id = a.SessionId
                    WHERE s.Status = 2
                      AND a.SelectedOptionId IS NOT NULL
                      AND a.IsCorrect = 0
                    GROUP BY s.UserId, a.QuestionId
                )
                INSERT INTO UserQuestionReviews
                    (Id, UserId, QuestionId, WrongCount, CorrectStreak, IsResolved, LastWrongAt, CreatedAt)
                SELECT
                    NEWID(),
                    c.UserId,
                    c.QuestionId,
                    ISNULL(t.SoLanSai, 1),
                    0,
                    0,
                    c.LucLam,
                    GETUTCDATE()
                FROM LanCuoi c
                LEFT JOIN TongSoLanSai t
                       ON t.UserId = c.UserId AND t.QuestionId = c.QuestionId
                WHERE c.Hang = 1
                  AND c.SelectedOptionId IS NOT NULL
                  AND c.IsCorrect = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserQuestionReviews");
        }
    }
}
