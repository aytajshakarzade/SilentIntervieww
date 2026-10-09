using BCrypt.Net;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Infrastructure.Persistence;

/// <summary>
/// Initializes required platform data and removes legacy demo accounts.
/// The SuperAdmin account is created from environment credentials when supplied.
/// Safe to call on every startup.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedAsync(SilentInterviewDbContext db)
    {
        await CleanupLegacyDemoDataAsync(db);

        var superAdminEmail = Environment.GetEnvironmentVariable("SUPERADMIN_EMAIL")?.Trim().ToLowerInvariant();
        var superAdminPassword = Environment.GetEnvironmentVariable("SUPERADMIN_PASSWORD");
        if (!string.IsNullOrWhiteSpace(superAdminEmail) && !string.IsNullOrWhiteSpace(superAdminPassword))
        {
            var superAdmin = await db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Email == superAdminEmail);
            if (superAdmin == null)
            {
                db.Users.Add(new User
                {
                    Id = new Guid("20000000-0000-0000-0000-000000000003"),
                    FullName = "SilentInterview Super Admin",
                    Email = superAdminEmail,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(superAdminPassword),
                    Role = Role.SuperAdmin,
                    EmailConfirmed = true,
                    IsActive = true,
                    Plan = "Pro",
                    CreatedAt = DateTime.UtcNow
                });
                await db.SaveChangesAsync();
            }
        }
    }

    private static async Task CleanupLegacyDemoDataAsync(SilentInterviewDbContext db)
    {
        var demoEmails = new[] { "recruiter@demo.com", "candidate@demo.com" };
        var demoUsers = await db.Users.IgnoreQueryFilters()
            .Where(x => demoEmails.Contains(x.Email.ToLower()))
            .ToListAsync();

        foreach (var user in demoUsers)
        {
            user.IsActive = false;
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
        }

        var demoCompany = await db.Companies.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == new Guid("10000000-0000-0000-0000-000000000001") || x.Name == "Acme Recruitment");
        if (demoCompany != null)
        {
            demoCompany.IsDeleted = true;
            demoCompany.DeletedAt = DateTime.UtcNow;
        }

        var demoJob = await db.Jobs.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.Id == new Guid("40000000-0000-0000-0000-000000000001"));
        if (demoJob != null)
        {
            demoJob.IsDeleted = true;
            demoJob.DeletedAt = DateTime.UtcNow;
        }

        if (demoUsers.Count > 0 || demoCompany != null || demoJob != null)
            await db.SaveChangesAsync();
    }

}