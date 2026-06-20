using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ToeicMasterPro.Application.Common.Interfaces;
using ToeicMasterPro.Domain.Entities;

namespace ToeicMasterPro.Infrastructure.Persistence;

// IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
// → tự tạo các bảng Identity: AspNetUsers, AspNetRoles, AspNetUserRoles...
public class ApplicationDbContext
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>, IApplicationDbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<Test> Tests => Set<Test>();
    public DbSet<TestQuestion> TestQuestions => Set<TestQuestion>();
    public DbSet<TestSession> TestSessions => Set<TestSession>();
    public DbSet<TestSessionAnswer> TestSessionAnswers => Set<TestSessionAnswer>();
    public DbSet<Vocabulary> Vocabularies => Set<Vocabulary>();
    public DbSet<UserVocabulary> UserVocabularies => Set<UserVocabulary>();
    public DbSet<ExamSchedule> ExamSchedules => Set<ExamSchedule>();
    public DbSet<UserExamReminder> UserExamReminders => Set<UserExamReminder>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder); // quan trọng: gọi base để Identity tables được tạo

        // Tự động áp dụng tất cả IEntityTypeConfiguration trong assembly này
        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
