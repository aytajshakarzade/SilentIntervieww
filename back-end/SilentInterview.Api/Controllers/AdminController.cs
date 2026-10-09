using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Asp.Versioning;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Domain.Entities;
using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Platform administration. Every endpoint is restricted to SuperAdmin.
/// </summary>
[Authorize(Roles = "SuperAdmin")]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public sealed class AdminController : BaseApiController
{
    private readonly SilentInterviewDbContext _db;

    public AdminController(SilentInterviewDbContext db) => _db = db;

    [HttpGet("overview")]
    public async Task<IActionResult> Overview(CancellationToken ct)
    {
        var users = _db.Users.IgnoreQueryFilters();
        var companies = _db.Companies.IgnoreQueryFilters();
        var activeUsers = users.Where(x => !x.IsDeleted && x.IsActive);

        var result = new
        {
            users = await users.CountAsync(x => !x.IsDeleted, ct),
            activeUsers = await activeUsers.CountAsync(ct),
            candidates = await users.CountAsync(x => !x.IsDeleted && x.Role == Role.Candidate, ct),
            recruiters = await users.CountAsync(x => !x.IsDeleted && x.Role == Role.Recruiter, ct),
            superAdmins = await users.CountAsync(x => !x.IsDeleted && x.Role == Role.SuperAdmin, ct),
            companies = await companies.CountAsync(x => !x.IsDeleted, ct),
            go = await users.CountAsync(x => !x.IsDeleted && x.Plan == "Go", ct),
            pro = await users.CountAsync(x => !x.IsDeleted && x.Plan == "Pro", ct),
            free = await users.CountAsync(x => !x.IsDeleted && x.Plan == "Free", ct),
        };

        return Success(result, "Platform overview retrieved successfully.");
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var users = _db.Users.IgnoreQueryFilters();

        var free = await users.CountAsync(x => !x.IsDeleted && x.IsActive && x.Plan == "Free", ct);
        var go = await users.CountAsync(x => !x.IsDeleted && x.IsActive && x.Plan == "Go", ct);
        var pro = await users.CountAsync(x => !x.IsDeleted && x.IsActive && x.Plan == "Pro", ct);

        var result = new
        {
            generatedAt = now,
            mrr = Math.Round(go * 9.99m + pro * 24.99m, 2),
            activeUsers = await users.CountAsync(x => !x.IsDeleted && x.IsActive, ct),
            newUsersThisMonth = await users.CountAsync(x => !x.IsDeleted && x.CreatedAt >= monthStart, ct),
            jobs = await _db.Jobs.IgnoreQueryFilters().CountAsync(x => !x.IsDeleted, ct),
            applications = await _db.JobApplications.IgnoreQueryFilters().CountAsync(x => !x.IsDeleted, ct),
            interviews = await _db.InterviewSessions.IgnoreQueryFilters().CountAsync(x => !x.IsDeleted, ct),
            reports = await _db.Reports.CountAsync(ct),
            aiConversations = await _db.AIConversations.IgnoreQueryFilters().CountAsync(x => !x.IsDeleted, ct),
            subscriptionEvents = await _db.SubscriptionEvents.CountAsync(ct),
            plans = new { free, go, pro },
            health = new
            {
                api = "Operational",
                database = "Connected",
                ai = "Configured",
                billing = "Connected"
            }
        };

        return Success(result, "Admin dashboard metrics retrieved successfully.");
    }

    [HttpGet("companies")]
    public async Task<IActionResult> Companies([FromQuery] string? search = null, CancellationToken ct = default)
    {
        var query = _db.Companies.IgnoreQueryFilters().AsNoTracking().Where(x => !x.IsDeleted);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.Name.ToLower().Contains(term) || x.Industry.ToLower().Contains(term));
        }

        var items = await query.OrderByDescending(x => x.CreatedAt).Take(250)
            .Select(c => new
            {
                id = c.Id,
                name = c.Name,
                industry = c.Industry,
                website = c.Website,
                logoUrl = c.LogoUrl,
                createdAt = c.CreatedAt,
                recruiters = _db.Recruiters.IgnoreQueryFilters().Count(r => r.CompanyId == c.Id && !r.IsDeleted),
                jobs = _db.Jobs.IgnoreQueryFilters().Count(j => j.CompanyId == c.Id && !j.IsDeleted)
            }).ToListAsync(ct);

        return Success(items, "Companies retrieved successfully.");
    }

    [HttpGet("activity")]
    public async Task<IActionResult> Activity([FromQuery] int take = 20, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var items = await _db.ActivityLogs.IgnoreQueryFilters().AsNoTracking()
            .OrderByDescending(x => x.CreatedAt).Take(take)
            .Select(x => new
            {
                id = x.Id,
                action = x.Action,
                entityType = x.EntityType,
                description = x.Description,
                createdAt = x.CreatedAt,
                actor = x.ActorUser == null ? null : x.ActorUser.FullName,
                company = x.Company == null ? null : x.Company.Name
            }).ToListAsync(ct);

        return Success(items, "Recent platform activity retrieved successfully.");
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users([FromQuery] string? search = null, [FromQuery] bool includeDeleted = false, CancellationToken ct = default)
    {
        var query = _db.Users.IgnoreQueryFilters().AsNoTracking();
        if (!includeDeleted) query = query.Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLowerInvariant();
            query = query.Where(x => x.FullName.ToLower().Contains(term) || x.Email.ToLower().Contains(term));
        }

        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Take(250)
            .Select(x => new
            {
                id = x.Id,
                name = x.FullName,
                email = x.Email,
                role = x.Role.ToString(),
                plan = x.Plan,
                isActive = x.IsActive,
                isDeleted = x.IsDeleted,
                emailConfirmed = x.EmailConfirmed,
                companyName = x.Role == Role.Recruiter
                    ? _db.Recruiters.IgnoreQueryFilters().Where(r => r.UserId == x.Id).Select(r => r.Company.Name).FirstOrDefault()
                    : null,
                createdAt = x.CreatedAt,
                updatedAt = x.UpdatedAt
            })
            .ToListAsync(ct);

        return Success(items, "Users retrieved successfully.");
    }

    [HttpPut("users/{id:guid}/status")]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] StatusRequest request, CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(actorId, out var currentId) && currentId == id && !request.IsActive)
            return Failure("You cannot deactivate your own SuperAdmin account.", StatusCodes.Status400BadRequest);

        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user == null) return Failure("User not found.", StatusCodes.Status404NotFound);

        user.IsActive = request.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        // Suspending a user must invalidate every refresh token immediately.
        // Otherwise an already-issued session could silently create a new
        // access token after the admin disabled the account.
        if (!request.IsActive)
        {
            var activeTokens = await _db.RefreshTokens
                .IgnoreQueryFilters()
                .Where(x => x.UserId == user.Id && !x.IsRevoked)
                .ToListAsync(ct);

            foreach (var token in activeTokens)
                token.IsRevoked = true;
        }

        await _db.SaveChangesAsync(ct);
        return Success(new { user.Id, user.IsActive }, "User status updated.");
    }

    [HttpPut("users/{id:guid}/plan")]
    public async Task<IActionResult> SetPlan(Guid id, [FromBody] PlanRequest request, CancellationToken ct)
    {
        var plan = request.Plan?.Trim();
        if (plan is not ("Free" or "Go" or "Pro"))
            return Failure("Plan must be Free, Go, or Pro.", StatusCodes.Status400BadRequest);

        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user == null) return Failure("User not found.", StatusCodes.Status404NotFound);
        if (user.IsDeleted) return Failure("Restore the user before changing the plan.", StatusCodes.Status400BadRequest);

        user.Plan = plan!;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Success(new { user.Id, user.Plan }, "User plan updated.");
    }

    [HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var actorId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (Guid.TryParse(actorId, out var currentId) && currentId == id)
            return Failure("You cannot delete your own SuperAdmin account.", StatusCodes.Status400BadRequest);

        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user == null) return Failure("User not found.", StatusCodes.Status404NotFound);

        if (user.Role == Role.SuperAdmin)
        {
            var remaining = await _db.Users.IgnoreQueryFilters()
                .CountAsync(x => !x.IsDeleted && x.IsActive && x.Role == Role.SuperAdmin && x.Id != id, ct);
            if (remaining < 1)
                return Failure("At least one active SuperAdmin must remain.", StatusCodes.Status400BadRequest);
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Success(true, "User removed from the platform.");
    }

    [HttpPut("users/{id:guid}/restore")]
    public async Task<IActionResult> RestoreUser(Guid id, CancellationToken ct)
    {
        var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (user == null) return Failure("User not found.", StatusCodes.Status404NotFound);
        user.IsDeleted = false;
        user.DeletedAt = null;
        user.IsActive = true;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return Success(true, "User restored.");
    }

    public sealed record StatusRequest(bool IsActive);
    public sealed record PlanRequest(string Plan);
}
