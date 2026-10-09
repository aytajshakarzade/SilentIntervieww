namespace SilentInterview.Api.Subscriptions;

/// <summary>
/// Single commercial policy used by both the API and the UI contract.
/// Positive numbers are monthly caps; -1 means unlimited.
/// </summary>
public static class PlanLimits
{
    public const string Free = "Free";
    public const string Go = "Go";
    public const string Pro = "Pro";

    public static string Normalize(string? plan)
    {
        var value = plan?.Trim();
        if (string.Equals(value, Go, StringComparison.OrdinalIgnoreCase)) return Go;
        if (string.Equals(value, Pro, StringComparison.OrdinalIgnoreCase)) return Pro;
        return Free;
    }

    public static string EffectivePlan(string? plan, DateTime? currentPeriodEnd)
    {
        var normalized = Normalize(plan);
        if (normalized == Free) return Free;

        // A paid plan may be assigned directly by an administrator or by a
        // successful checkout/webhook before the billing provider has supplied
        // a period end. A missing end date is therefore treated as "unknown",
        // not as "expired". Only an explicitly expired period downgrades the
        // effective plan.
        return currentPeriodEnd.HasValue && currentPeriodEnd.Value <= DateTime.UtcNow
            ? Free
            : normalized;
    }

    public static int InterviewsPerMonth(string? plan) => Normalize(plan) switch
    {
        Pro => -1,
        Go => 25,
        _ => 3
    };

    public static int AiActionsPerMonth(string? plan) => Normalize(plan) switch
    {
        Pro => -1,
        Go => 100,
        _ => 10
    };

    public static int AssistantMessagesPerMonth(string? plan) => Normalize(plan) switch
    {
        Pro => -1,
        Go => 50,
        _ => 0
    };

    public static int ActiveJobs(string? plan) => Normalize(plan) switch
    {
        Pro => -1,
        Go => 25,
        _ => 3
    };

    public static bool HasAiFeatures(string? plan) => AiActionsPerMonth(plan) != 0;
    public static bool HasAssistant(string? plan) => Normalize(plan) is Go or Pro;
    public static bool HasAdvancedAnalytics(string? plan) => Normalize(plan) is Go or Pro;
    public static bool HasPriorityAi(string? plan) => Normalize(plan) is Go or Pro;

    public static DateTime MonthStartUtc()
    {
        var now = DateTime.UtcNow;
        return new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }
}
