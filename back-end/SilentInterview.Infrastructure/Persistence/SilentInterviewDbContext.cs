using Microsoft.EntityFrameworkCore;
using SilentInterview.Domain.Common;
using SilentInterview.Domain.Entities;
using SilentInterview.Domain.Enums;
using SilentInterview.Infrastructure.Persistence.Configurations;

namespace SilentInterview.Infrastructure.Persistence;

public class SilentInterviewDbContext : DbContext
{
    public SilentInterviewDbContext(
        DbContextOptions<SilentInterviewDbContext> options)
        : base(options)
    {
    }

    // Authentication
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<SubscriptionEvent> SubscriptionEvents => Set<SubscriptionEvent>();

    // Company
    public DbSet<Company> Companies => Set<Company>();

    // Recruiter
    public DbSet<Recruiter> Recruiters => Set<Recruiter>();

    // Candidate
    public DbSet<Candidate> Candidates => Set<Candidate>();

    // Job
    public DbSet<Job> Jobs => Set<Job>();

    // Job Application
    public DbSet<JobApplication> JobApplications => Set<JobApplication>();

    // Interview
    public DbSet<InterviewSession> InterviewSessions => Set<InterviewSession>();
    public DbSet<InterviewAnswer> InterviewAnswers => Set<InterviewAnswer>();

    // Reports
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<ActivityLog> ActivityLogs => Set<ActivityLog>();
    public DbSet<InterviewEvent> InterviewEvents => Set<InterviewEvent>();

    // AI
    public DbSet<AIInterviewPlan> AIInterviewPlans => Set<AIInterviewPlan>();
    public DbSet<AIAnswerEvaluation> AIAnswerEvaluations => Set<AIAnswerEvaluation>();
    public DbSet<AIConversation> AIConversations => Set<AIConversation>();
    public DbSet<AIConversationMessage> AIConversationMessages => Set<AIConversationMessage>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global soft-delete filter — applied to every entity that derives
        // from AuditableEntity (i.e. has IsDeleted). Callers that need
        // deleted rows (admin "show deleted" views, restore endpoints) use
        // IgnoreQueryFilters() explicitly rather than manual !x.IsDeleted
        // checks scattered across services.
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(AuditableEntity).IsAssignableFrom(entityType.ClrType))
                continue;

            var parameter = System.Linq.Expressions.Expression.Parameter(entityType.ClrType, "x");
            var property = System.Linq.Expressions.Expression.Property(parameter, nameof(AuditableEntity.IsDeleted));
            var notDeleted = System.Linq.Expressions.Expression.Not(property);
            var lambda = System.Linq.Expressions.Expression.Lambda(notDeleted, parameter);

            modelBuilder.Entity(entityType.ClrType).HasQueryFilter(lambda);
        }

        // Configurations
        modelBuilder.ApplyConfiguration(new RefreshTokenConfiguration());

        // User
        modelBuilder.Entity<User>()
            .HasIndex(x => x.Email)
            .IsUnique();
        modelBuilder.Entity<User>().Property(x => x.Plan).HasMaxLength(20).IsRequired();
        modelBuilder.Entity<User>().Property(x => x.StripeCustomerId).HasMaxLength(100);
        modelBuilder.Entity<User>().Property(x => x.StripeSubscriptionId).HasMaxLength(100);
        modelBuilder.Entity<User>().HasIndex(x => x.StripeCustomerId);

        modelBuilder.Entity<PasswordResetToken>().HasIndex(x => x.TokenHash).IsUnique();
        modelBuilder.Entity<PasswordResetToken>()
            .HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<SubscriptionEvent>().HasIndex(x => x.StripeEventId).IsUnique();

        // Recruiter -> Company
        modelBuilder.Entity<Recruiter>()
            .HasOne(x => x.Company)
            .WithMany(x => x.Recruiters)
            .HasForeignKey(x => x.CompanyId);

        // Candidate -> User
        modelBuilder.Entity<Candidate>()
            .HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId);

        // Job -> Company
        modelBuilder.Entity<Job>()
            .HasOne(x => x.Company)
            .WithMany(x => x.Jobs)
            .HasForeignKey(x => x.CompanyId);

        // Job — Phase 3A interview configuration column lengths.
        // Configured explicitly (instead of leaving convention-default
        // nvarchar(max)) so the compiled model uses PostgreSQL-native text storage;
        // snapshot exactly and EF does not detect pending changes at
        // startup.
        modelBuilder.Entity<Job>()
            .Property(x => x.Experience)
            .HasMaxLength(50);

        modelBuilder.Entity<Job>()
            .Property(x => x.Skills)
            .HasMaxLength(2000);

        modelBuilder.Entity<Job>()
            .Property(x => x.Difficulty)
            .HasMaxLength(50);

        modelBuilder.Entity<Job>()
            .Property(x => x.Language)
            .HasMaxLength(10);

        modelBuilder.Entity<Job>()
            .Property(x => x.Culture)
            .HasMaxLength(2000);

        // JobApplication.Status — stored as a PostgreSQL text column,
        // exposed as the ApplicationStatus enum in code. HasConversion keeps
        // the physical column type/values unchanged (Phase 4B: enum in C#,
        // no destructive schema change, no data migration required).
        modelBuilder.Entity<JobApplication>()
            .Property(x => x.Status)
            .HasConversion<string>()
            .HasColumnType("text")
            .IsRequired();

        // JobApplication -> Job
        modelBuilder.Entity<JobApplication>()
            .HasOne(x => x.Job)
            .WithMany(x => x.Applications)
            .HasForeignKey(x => x.JobId);

        // JobApplication -> Candidate
        modelBuilder.Entity<JobApplication>()
            .HasOne(x => x.Candidate)
            .WithMany()
            .HasForeignKey(x => x.CandidateId);

        // InterviewSession -> JobApplication
        modelBuilder.Entity<InterviewSession>()
            .HasOne(x => x.JobApplication)
            .WithMany(x => x.InterviewSessions)
            .HasForeignKey(x => x.JobApplicationId);

        // InterviewSession.Language — configured explicitly to match the
        // entity property and ensure consistent column configuration.
        modelBuilder.Entity<InterviewSession>()
            .Property(x => x.Language)
            .HasMaxLength(10);

        // InterviewAnswer -> InterviewSession
        modelBuilder.Entity<InterviewAnswer>()
            .HasOne(x => x.InterviewSession)
            .WithMany(x => x.Answers)
            .HasForeignKey(x => x.InterviewSessionId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<InterviewAnswer>()
            .HasIndex(x => new { x.InterviewSessionId, x.Order })
            .IsUnique();

        modelBuilder.Entity<InterviewAnswer>()
            .Property(x => x.DominantEmotion)
            .HasMaxLength(50);

        modelBuilder.Entity<InterviewAnswer>()
            .Property(x => x.LongestPauseSec)
            .HasPrecision(10, 2);

        // Report — extended analytics stored as JSON text columns. Kept as
        // plain PostgreSQL text (no owned/complex type) so existing reports
        // with null values continue to work without extra configuration.
        modelBuilder.Entity<Report>()
            .Property(x => x.SkillBreakdownJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.TimelineJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.EmotionAnalysisJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.EyeContactAnalysisJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.SpeechAnalysisJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.StrengthsJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.WeaknessesJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.RecommendationsJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.AiSummary)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.Grade)
            .HasMaxLength(2);
        modelBuilder.Entity<Report>()
            .Property(x => x.HiringRecommendation)
            .HasMaxLength(50);

        modelBuilder.Entity<InterviewEvent>()
            .HasOne(x => x.InterviewSession)
            .WithMany(x => x.Events)
            .HasForeignKey(x => x.InterviewSessionId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<InterviewEvent>()
            .Property(x => x.Type)
            .HasMaxLength(100)
            .IsRequired();
        modelBuilder.Entity<InterviewEvent>()
            .Property(x => x.Detail)
            .HasMaxLength(2000);
        modelBuilder.Entity<InterviewEvent>()
            .HasIndex(x => new { x.InterviewSessionId, x.OccurredAt });

        modelBuilder.Entity<Notification>()
            .HasOne(x => x.User)
            .WithMany(x => x.Notifications)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<Notification>()
            .Property(x => x.Type)
            .HasMaxLength(100)
            .IsRequired();
        modelBuilder.Entity<Notification>()
            .Property(x => x.Title)
            .HasMaxLength(200)
            .IsRequired();
        modelBuilder.Entity<Notification>()
            .Property(x => x.Message)
            .HasMaxLength(2000)
            .IsRequired();
        modelBuilder.Entity<Notification>()
            .Property(x => x.Link)
            .HasMaxLength(500);
        modelBuilder.Entity<Notification>()
            .HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });

        modelBuilder.Entity<ActivityLog>()
            .HasOne(x => x.Company)
            .WithMany(x => x.ActivityLogs)
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ActivityLog>()
            .HasOne(x => x.ActorUser)
            .WithMany()
            .HasForeignKey(x => x.ActorUserId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<ActivityLog>()
            .Property(x => x.Action)
            .HasMaxLength(100)
            .IsRequired();
        modelBuilder.Entity<ActivityLog>()
            .Property(x => x.EntityType)
            .HasMaxLength(100)
            .IsRequired();
        modelBuilder.Entity<ActivityLog>()
            .Property(x => x.Description)
            .HasMaxLength(2000)
            .IsRequired();
        modelBuilder.Entity<ActivityLog>()
            .HasIndex(x => new { x.CompanyId, x.CreatedAt });

        // RefreshToken -> User
        modelBuilder.Entity<RefreshToken>()
            .HasOne(x => x.User)
            .WithMany(x => x.RefreshTokens)
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // Interview sessions are not AuditableEntity because their lifecycle
        // is intentionally lightweight, but they still participate in the
        // parent Job/Company soft-delete cascade. Keep deleted sessions out
        // of every normal query (HR, Candidate, reports, AI, analytics).
        modelBuilder.Entity<InterviewSession>()
            .HasQueryFilter(x => !x.IsDeleted);

        // ── AI ──────────────────────────────────────────────────────────

        // AIInterviewPlan -> InterviewSession (1:1)
        modelBuilder.Entity<AIInterviewPlan>()
            .HasOne(x => x.InterviewSession)
            .WithOne(x => x.AIInterviewPlan)
            .HasForeignKey<AIInterviewPlan>(x => x.InterviewSessionId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AIInterviewPlan>()
            .HasIndex(x => x.InterviewSessionId)
            .IsUnique();
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.SectionsJson)
            .HasColumnType("text")
            .IsRequired();
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.Language)
            .HasMaxLength(10)
            .IsRequired();
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.InterviewTitle)
            .HasMaxLength(300);
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.Difficulty)
            .HasMaxLength(50);
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.Introduction)
            .HasColumnType("text");
        modelBuilder.Entity<AIInterviewPlan>()
            .Property(x => x.GeneratedByModel)
            .HasMaxLength(200);

        // AIAnswerEvaluation -> InterviewAnswer (1:1) and -> AIInterviewPlan (many:1)
        modelBuilder.Entity<AIAnswerEvaluation>()
            .HasOne(x => x.InterviewAnswer)
            .WithOne()
            .HasForeignKey<AIAnswerEvaluation>(x => x.InterviewAnswerId)
            .OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<AIAnswerEvaluation>()
            .HasIndex(x => x.InterviewAnswerId)
            .IsUnique();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .HasOne(x => x.AIInterviewPlan)
            .WithMany(x => x.AnswerEvaluations)
            .HasForeignKey(x => x.AIInterviewPlanId)
            .OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.KeywordsDetectedJson)
            .HasColumnType("text")
            .IsRequired();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.StrengthsJson)
            .HasColumnType("text")
            .IsRequired();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.WeaknessesJson)
            .HasColumnType("text")
            .IsRequired();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.AiComment)
            .HasColumnType("text")
            .IsRequired();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.NextAction)
            .HasMaxLength(30)
            .IsRequired();
        modelBuilder.Entity<AIAnswerEvaluation>()
            .Property(x => x.GeneratedByModel)
            .HasMaxLength(200);

        // Report — AI report fields
        modelBuilder.Entity<Report>()
            .Property(x => x.AiReportJson)
            .HasColumnType("text");
        modelBuilder.Entity<Report>()
            .Property(x => x.AiReportLanguage)
            .HasMaxLength(10);
        modelBuilder.Entity<Report>()
            .Property(x => x.AiReportGeneratedByModel)
            .HasMaxLength(200);

        // ── AI Conversation & Messages ──────────────────────────────────────
        
        // AIConversation -> User
        modelBuilder.Entity<AIConversation>()
            .HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // AIConversation -> Company (optional)
        modelBuilder.Entity<AIConversation>()
            .HasOne(x => x.Company)
            .WithMany()
            .HasForeignKey(x => x.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);
        
        // AIConversation indexes for performance
        modelBuilder.Entity<AIConversation>()
            .HasIndex(x => x.UserId);
        modelBuilder.Entity<AIConversation>()
            .HasIndex(x => new { x.UserId, x.UpdatedAt });
        
        // AIConversation properties
        modelBuilder.Entity<AIConversation>()
            .Property(x => x.Language)
            .HasMaxLength(10)
            .IsRequired();
        modelBuilder.Entity<AIConversation>()
            .Property(x => x.Title)
            .HasMaxLength(300)
            .IsRequired();
        
        // AIConversationMessage -> AIConversation
        modelBuilder.Entity<AIConversationMessage>()
            .HasOne(x => x.Conversation)
            .WithMany(x => x.Messages)
            .HasForeignKey(x => x.ConversationId)
            .OnDelete(DeleteBehavior.Cascade);
        
        // AIConversationMessage indexes for performance
        modelBuilder.Entity<AIConversationMessage>()
            .HasIndex(x => x.ConversationId);
        modelBuilder.Entity<AIConversationMessage>()
            .HasIndex(x => new { x.ConversationId, x.CreatedAt });
        
        // AIConversationMessage properties
        modelBuilder.Entity<AIConversationMessage>()
            .Property(x => x.Role)
            .HasMaxLength(20)
            .IsRequired();
        modelBuilder.Entity<AIConversationMessage>()
            .Property(x => x.Content)
            .HasColumnType("text")
            .IsRequired();
    }
}
