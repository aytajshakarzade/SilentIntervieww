using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.AI;
using SilentInterview.Infrastructure.Persistence;
using SilentInterview.Infrastructure.Repositories;
using SilentInterview.Infrastructure.Services;

namespace SilentInterview.Infrastructure.DependencyInjection;

public static class ServiceRegistration
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Database
        services.AddDbContext<SilentInterviewDbContext>(options =>
        {
            options.UseNpgsql(
                configuration.GetConnectionString("DefaultConnection"),
                npgsqlOptions =>
                {
                    npgsqlOptions.MigrationsHistoryTable("__EFMigrationsHistory");
                });
            options.ConfigureWarnings(warnings =>
                warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
        });

        // Authentication
        services.AddScoped<IJwtService, JwtService>();
        services.AddScoped<IAuthService, AuthService>();

        // Unit Of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<ICompanyRepository, CompanyRepository>();

        // Generic Repository
        services.AddScoped(typeof(IGenericRepository<>),
                           typeof(GenericRepository<>));

        // Business Services
        services.AddScoped<ICompanyService, CompanyService>();
        services.AddScoped<IJobService, JobService>();
        services.AddScoped<ICandidateService, CandidateService>();
        services.AddScoped<IRecruiterService, RecruiterService>();
        services.AddScoped<IJobApplicationService, JobApplicationService>();
        services.AddScoped<IInterviewSessionService, InterviewSessionService>();
        services.AddScoped<IInterviewAnswerService, InterviewAnswerService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IActivityLogService, ActivityLogService>();
        services.AddScoped<IInterviewTimelineService, InterviewTimelineService>();

        // AI Services
        services.AddScoped<IQuestionGenerationService, QuestionGenerationService>();
        services.AddScoped<IInterviewAIService, InterviewAIService>();
        services.AddScoped<IReportAIService, ReportAIService>();
        services.AddScoped<IAIAssistantService, AIAssistantService>();

        return services;
    }
}
