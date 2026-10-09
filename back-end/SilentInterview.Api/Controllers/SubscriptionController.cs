using Microsoft.AspNetCore.Authorization;
using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Subscriptions;
using SilentInterview.Infrastructure.Persistence;
using Stripe;
using Stripe.Checkout;
using System.Security.Claims;

namespace SilentInterview.Api.Controllers;

[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/subscription")]
public class SubscriptionController : BaseApiController
{
    private static readonly IReadOnlyDictionary<string, (decimal Price, string Name, string Description)> Plans =
        new Dictionary<string, (decimal, string, string)>(StringComparer.OrdinalIgnoreCase)
        {
            [PlanLimits.Go] = (9.99m, "SilentInterview Go", "For candidates and small recruiting workflows"),
            [PlanLimits.Pro] = (24.99m, "SilentInterview Pro", "Unlimited recruiting power and advanced AI")
        };

    private readonly SilentInterviewDbContext _context;
    private readonly IConfiguration _config;

    public SubscriptionController(SilentInterviewDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    [HttpGet("plans")]
    [AllowAnonymous]
    public IActionResult GetPlans([FromQuery] string? role = null)
    {
        var recruiter = string.Equals(role, "recruiter", StringComparison.OrdinalIgnoreCase);
        var plans = new[] { PlanLimits.Free, PlanLimits.Go, PlanLimits.Pro }.Select(plan =>
        {
            var price = plan == PlanLimits.Free ? 0m : plan == PlanLimits.Go ? 9.99m : 24.99m;
            var monthlyInterviews = recruiter ? -1 : PlanLimits.InterviewsPerMonth(plan);
            var activeJobs = recruiter ? PlanLimits.ActiveJobs(plan) : -1;
            var assistant = recruiter && PlanLimits.HasAssistant(plan);
            var assistantMessages = recruiter ? PlanLimits.AssistantMessagesPerMonth(plan) : 0;
            var analytics = recruiter ? PlanLimits.HasAdvancedAnalytics(plan) : PlanLimits.HasAdvancedAnalytics(plan);
            var priority = PlanLimits.HasPriorityAi(plan);

            var features = recruiter
                ? new[]
                {
                    $"{activeJobs switch { -1 => "Unlimited", _ => activeJobs.ToString() }} active jobs",
                    $"{PlanLimits.AiActionsPerMonth(plan) switch { -1 => "Unlimited", _ => PlanLimits.AiActionsPerMonth(plan).ToString() }} AI interview/report actions / month",
                    assistant ? "AI HR Assistant" : "Core recruiter tools",
                    assistant ? $"{assistantMessages switch { -1 => "Unlimited", _ => assistantMessages.ToString() }} assistant messages / month" : "Candidate management",
                    analytics ? "Advanced analytics" : "Core analytics",
                    priority ? "Priority AI processing" : "Standard AI processing"
                }
                : new[]
                {
                    $"{monthlyInterviews switch { -1 => "Unlimited", _ => monthlyInterviews.ToString() }} interviews / month",
                    $"{PlanLimits.AiActionsPerMonth(plan) switch { -1 => "Unlimited", _ => PlanLimits.AiActionsPerMonth(plan).ToString() }} AI interview/report actions / month",
                    PlanLimits.HasAiFeatures(plan) ? "AI interview feedback" : "Interview practice",
                    analytics ? "Advanced analytics" : "Core reports",
                    priority ? "Priority AI processing" : "Standard AI processing"
                };

            var description = recruiter
                ? plan switch
                {
                    PlanLimits.Free => "Run focused hiring with the essentials.",
                    PlanLimits.Go => "More hiring capacity plus AI-powered recruiting tools.",
                    _ => "Unlimited recruiting capacity with premium AI."
                }
                : plan switch
                {
                    PlanLimits.Free => "Build interview confidence with core AI-powered practice.",
                    PlanLimits.Go => "More interview practice and deeper AI insights.",
                    _ => "Unlimited interview practice and premium AI analysis."
                };

            return new
            {
                id = plan,
                name = plan,
                price,
                description,
                limits = new
                {
                    monthlyInterviews,
                    monthlyAiActions = PlanLimits.AiActionsPerMonth(plan),
                    monthlyAssistantMessages = assistantMessages,
                    activeJobs
                },
                capabilities = new
                {
                    aiInterview = PlanLimits.HasAiFeatures(plan),
                    aiHrAssistant = assistant,
                    advancedAnalytics = analytics,
                    priorityAi = priority
                },
                features
            };
        }).ToArray();

        return Success(plans, "Plans retrieved successfully.");
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = GetUserId();
        var user = await _context.Users.FindAsync(id);
        if (user == null) return Failure("User not found.", 404);

        var plan = PlanLimits.EffectivePlan(user.Plan, user.SubscriptionCurrentPeriodEnd);
        var active = plan != PlanLimits.Free;

        return Success(new
        {
            plan,
            renewalDate = user.SubscriptionCurrentPeriodEnd,
            active,
            stripeCustomerId = user.StripeCustomerId,
            stripeSubscriptionId = user.StripeSubscriptionId,
            limits = new
            {
                monthlyInterviews = PlanLimits.InterviewsPerMonth(plan),
                monthlyAiActions = PlanLimits.AiActionsPerMonth(plan),
                monthlyAssistantMessages = PlanLimits.AssistantMessagesPerMonth(plan),
                activeJobs = PlanLimits.ActiveJobs(plan),
                hasAssistant = PlanLimits.HasAssistant(plan),
                hasAdvancedAnalytics = PlanLimits.HasAdvancedAnalytics(plan)
            }
        }, "Subscription retrieved successfully.");
    }

    [HttpGet("usage")]
    public async Task<IActionResult> Usage()
    {
        var userId = GetUserId();
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Failure("User not found.", 404);

        var plan = PlanLimits.EffectivePlan(user.Plan, user.SubscriptionCurrentPeriodEnd);
        var monthStart = PlanLimits.MonthStartUtc();

        var interviews = await _context.InterviewSessions
            .Where(x => x.StartedAt >= monthStart &&
                (User.IsInRole("Candidate")
                    ? x.JobApplication.Candidate.UserId == userId
                    : x.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)))
            .CountAsync();

        // An AI action is a billable/limitable AI generation event rather than
        // every token/answer evaluation. This keeps Free usable for a complete
        // interview while still making AI-heavy features meaningfully metered.
        var generatedPlans = await _context.AIInterviewPlans
            .Where(x => x.CreatedAt >= monthStart &&
                (User.IsInRole("Candidate")
                    ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                    : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)))
            .CountAsync();

        var reports = await _context.Reports
            .Where(x => x.CreatedAt >= monthStart &&
                (User.IsInRole("Candidate")
                    ? x.InterviewSession.JobApplication.Candidate.UserId == userId
                    : x.InterviewSession.JobApplication.Job.Company.Recruiters.Any(r => r.UserId == userId)))
            .CountAsync();

        var assistantMessages = await _context.AIConversationMessages
            .Where(x => x.CreatedAt >= monthStart && x.Role == "user" &&
                x.Conversation != null && x.Conversation.UserId == userId)
            .CountAsync();

        // AI actions are generation/report events. HR Assistant messages have
        // their own allowance (50 on Go, unlimited on Pro) and therefore must
        // not consume the separate AI-actions quota.
        var aiActions = generatedPlans + reports;
        var activeJobs = User.IsInRole("Candidate")
            ? 0
            : await _context.Jobs.CountAsync(x => !x.IsDeleted &&
                x.Company.Recruiters.Any(r => r.UserId == userId));

        return Success(new
        {
            plan,
            monthStart,
            interviews = new { used = interviews, limit = PlanLimits.InterviewsPerMonth(plan) },
            aiActions = new { used = aiActions, limit = PlanLimits.AiActionsPerMonth(plan) },
            assistantMessages = new { used = assistantMessages, limit = PlanLimits.AssistantMessagesPerMonth(plan) },
            activeJobs = new { used = activeJobs, limit = PlanLimits.ActiveJobs(plan) }
        }, "Subscription usage retrieved successfully.");
    }

    [HttpPost("checkout")]
    public async Task<IActionResult> Checkout(CheckoutRequest request)
    {
        var planName = PlanLimits.Normalize(request.Plan);
        if (!Plans.TryGetValue(planName, out var plan))
            return Failure("Choose Go or Pro.", 400);

        var secret = _config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret))
            return Failure("Stripe is not configured. Add Stripe:SecretKey to the environment.", 503);

        StripeConfiguration.ApiKey = secret;
        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null) return Failure("User not found.", 404);

        if (PlanLimits.EffectivePlan(user.Plan, user.SubscriptionCurrentPeriodEnd) == planName && user.StripeSubscriptionId != null)
            return Failure($"You already have the {planName} plan.", 409);

        var priceId = planName == PlanLimits.Go
            ? _config["Stripe:GoPriceId"]
            : _config["Stripe:ProPriceId"];

        if (string.IsNullOrWhiteSpace(priceId))
            return Failure($"Stripe price for {planName} is not configured. Add Stripe:{planName}PriceId.", 503);

        string? customerId = user.StripeCustomerId;
        if (string.IsNullOrWhiteSpace(customerId))
        {
            var customer = await new CustomerService().CreateAsync(new CustomerCreateOptions
            {
                Email = user.Email,
                Name = user.FullName,
                Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString() }
            });
            customerId = customer.Id;
            user.StripeCustomerId = customerId;
            await _context.SaveChangesAsync();
        }

        var frontend = (_config["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var options = new SessionCreateOptions
        {
            Mode = "subscription",
            Customer = customerId,
            SuccessUrl = $"{frontend}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{frontend}/billing",
            ClientReferenceId = user.Id.ToString(),
            Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString(), ["plan"] = planName },
            SubscriptionData = new SessionSubscriptionDataOptions
            {
                Metadata = new Dictionary<string, string> { ["userId"] = user.Id.ToString(), ["plan"] = planName }
            },
            LineItems = new List<SessionLineItemOptions>
            {
                new() { Quantity = 1, Price = priceId }
            }
        };

        var session = await new SessionService().CreateAsync(options);
        return Success(new { checkoutUrl = session.Url, sessionId = session.Id }, "Checkout session created.");
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncCheckout(SyncCheckoutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId))
            return Failure("Checkout session is required.", 400);

        var secret = _config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret)) return Failure("Stripe is not configured.", 503);
        StripeConfiguration.ApiKey = secret;

        var session = await new SessionService().GetAsync(request.SessionId);
        if (session == null || session.Status != "complete")
            return Failure("Stripe checkout is not completed yet.", 409);

        var userId = GetUserId();
        if (!Guid.TryParse(session.Metadata?.GetValueOrDefault("userId"), out var sessionUserId) || sessionUserId != userId)
            return Failure("Checkout session does not belong to this account.", 403);

        var plan = PlanLimits.Normalize(session.Metadata?.GetValueOrDefault("plan"));
        if (plan == PlanLimits.Free)
            return Failure("Invalid subscription plan.", 400);

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return Failure("User not found.", 404);

        user.Plan = plan;
        user.StripeCustomerId = session.CustomerId ?? user.StripeCustomerId;
        user.StripeSubscriptionId = session.SubscriptionId;

        // Read the real billing period from Stripe instead of guessing a
        // one-month renewal date. This keeps the account state aligned with
        // the actual subscription created by Checkout.
        if (!string.IsNullOrWhiteSpace(session.SubscriptionId))
        {
            var subscription = await new SubscriptionService().GetAsync(session.SubscriptionId);
            user.SubscriptionCurrentPeriodEnd = GetSubscriptionPeriodEnd(subscription);
        }
        else
        {
            user.SubscriptionCurrentPeriodEnd = DateTime.UtcNow.AddMonths(1);
        }

        await _context.SaveChangesAsync();

        return Success(new { plan, renewalDate = user.SubscriptionCurrentPeriodEnd }, "Subscription synchronized successfully.");
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel()
    {
        var secret = _config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret)) return Failure("Stripe is not configured.", 503);
        StripeConfiguration.ApiKey = secret;

        var user = await _context.Users.FindAsync(GetUserId());
        if (user == null) return Failure("User not found.", 404);
        if (PlanLimits.EffectivePlan(user.Plan, user.SubscriptionCurrentPeriodEnd) == PlanLimits.Free || string.IsNullOrWhiteSpace(user.StripeSubscriptionId))
            return Failure("There is no active paid subscription to cancel.", 400);

        var subscriptions = new SubscriptionService();
        var subscription = await subscriptions.GetAsync(user.StripeSubscriptionId);
        if (subscription == null) return Failure("Subscription could not be found in Stripe.", 404);

        if (subscription.CancelAtPeriodEnd)
        {
            var existingEnd = GetSubscriptionPeriodEnd(subscription) ?? user.SubscriptionCurrentPeriodEnd;
            return Success(new { scheduled = true, renewalDate = existingEnd }, "Subscription cancellation is already scheduled.");
        }

        var updated = await subscriptions.UpdateAsync(subscription.Id, new SubscriptionUpdateOptions
        {
            CancelAtPeriodEnd = true
        });

        user.SubscriptionCurrentPeriodEnd = GetSubscriptionPeriodEnd(updated) ?? user.SubscriptionCurrentPeriodEnd;
        await _context.SaveChangesAsync();

        return Success(new
        {
            scheduled = true,
            renewalDate = user.SubscriptionCurrentPeriodEnd
        }, "Subscription will be canceled at the end of the current billing period.");
    }

    [HttpPost("portal")]
    public async Task<IActionResult> Portal()
    {
        var secret = _config["Stripe:SecretKey"];
        if (string.IsNullOrWhiteSpace(secret)) return Failure("Stripe is not configured.", 503);
        StripeConfiguration.ApiKey = secret;
        var user = await _context.Users.FindAsync(GetUserId());
        if (user?.StripeCustomerId == null) return Failure("No active Stripe customer.", 400);
        var frontend = (_config["Frontend:BaseUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var session = await new Stripe.BillingPortal.SessionService().CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = user.StripeCustomerId,
            ReturnUrl = $"{frontend}/billing"
        });
        return Success(new { url = session.Url }, "Billing portal created.");
    }

    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault();
        var secret = _config["Stripe:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(secret)) return StatusCode(503, "Stripe webhook secret is not configured.");

        Event stripeEvent;
        try { stripeEvent = EventUtility.ConstructEvent(json, signature, secret, throwOnApiVersionMismatch: false); }
        catch { return BadRequest(); }

        if (await _context.SubscriptionEvents.AnyAsync(x => x.StripeEventId == stripeEvent.Id)) return Ok();

        Guid? userId = null;
        string? plan = null;

        if (stripeEvent.Data.Object is Session session)
        {
            if (Guid.TryParse(session.Metadata?.GetValueOrDefault("userId"), out var id)) userId = id;
            plan = session.Metadata?.GetValueOrDefault("plan");
        }

        if (stripeEvent.Type == EventTypes.CheckoutSessionCompleted &&
            stripeEvent.Data.Object is Session completed && userId.HasValue)
        {
            var u = await _context.Users.FindAsync(userId.Value);
            if (u != null)
            {
                u.Plan = PlanLimits.Normalize(plan);
                u.StripeCustomerId = completed.CustomerId ?? u.StripeCustomerId;
                u.StripeSubscriptionId = completed.SubscriptionId;

                if (!string.IsNullOrWhiteSpace(completed.SubscriptionId))
                {
                    var subscription = await new SubscriptionService().GetAsync(completed.SubscriptionId);
                    u.SubscriptionCurrentPeriodEnd = GetSubscriptionPeriodEnd(subscription);
                }
            }
        }

        if (stripeEvent.Type == EventTypes.CustomerSubscriptionUpdated &&
            stripeEvent.Data.Object is Subscription updated)
        {
            var u = await _context.Users.FirstOrDefaultAsync(x => x.StripeSubscriptionId == updated.Id);
            if (u != null)
            {
                userId ??= u.Id;
                var priceId = updated.Items?.Data?.FirstOrDefault()?.Price?.Id;
                var goPrice = _config["Stripe:GoPriceId"];
                var proPrice = _config["Stripe:ProPriceId"];
                if (!string.IsNullOrWhiteSpace(priceId) && priceId == goPrice) u.Plan = PlanLimits.Go;
                else if (!string.IsNullOrWhiteSpace(priceId) && priceId == proPrice) u.Plan = PlanLimits.Pro;
                u.StripeCustomerId = updated.CustomerId ?? u.StripeCustomerId;
                u.SubscriptionCurrentPeriodEnd = GetSubscriptionPeriodEnd(updated);
            }
        }

        if (stripeEvent.Type == EventTypes.CustomerSubscriptionDeleted && stripeEvent.Data.Object is Subscription deleted)
        {
            var u = await _context.Users.FirstOrDefaultAsync(x => x.StripeSubscriptionId == deleted.Id);
            if (u != null)
            {
                userId ??= u.Id;
                u.Plan = PlanLimits.Free;
                u.StripeSubscriptionId = null;
                u.SubscriptionCurrentPeriodEnd = null;
            }
        }

        await _context.SubscriptionEvents.AddAsync(new Domain.Entities.SubscriptionEvent
        {
            Id = Guid.NewGuid(),
            StripeEventId = stripeEvent.Id,
            EventType = stripeEvent.Type,
            UserId = userId,
            Payload = json
        });
        await _context.SaveChangesAsync();
        return Ok();
    }

    private static DateTime? GetSubscriptionPeriodEnd(Subscription subscription)
    {
        // Stripe API versions that use subscription-item billing periods expose
        // current_period_end on each subscription item rather than the top-level
        // Subscription object. Use the first active item for our single-price
        // subscriptions.
        return subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd;
    }

    private Guid GetUserId() => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public sealed record CheckoutRequest(string Plan);
    public sealed record SyncCheckoutRequest(string SessionId);
}
