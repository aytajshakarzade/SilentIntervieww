# SilentInterview v51 — AI, Plan Entitlements & UI Refresh

This release keeps the existing database and environment configuration untouched.

## Plan policy
- Candidate Free: 3 interviews/month + 10 AI interview/report actions/month; core reports; AI interview feedback.
- Candidate Go: 25 interviews/month + 100 AI interview/report actions/month; advanced analytics.
- Candidate Pro: unlimited interviews and AI interview/report actions; advanced analytics.
- Recruiter Free: 3 concurrent active jobs + 10 AI interview/report actions/month; AI HR Assistant locked; core analytics.
- Recruiter Go: 25 concurrent active jobs + 100 AI interview/report actions/month + 50 AI HR Assistant messages/month; advanced analytics.
- Recruiter Pro: unlimited active jobs and AI interview/report actions + unlimited AI HR Assistant messages; advanced analytics.

AI interview/report allowance is intentionally separate from the recruiter AI HR Assistant message allowance. Active-job capacity is a concurrent limit, not a monthly quota.

## AI assistant behavior
The recruiter AI HR Assistant no longer fabricates a deterministic ranked answer when the configured AI provider is unavailable. Provider failures surface as a compact retryable state. Successful turns are persisted; failed provider calls do not create user/assistant message usage records.

## UI refresh
- More whitespace and stronger visual grouping on recruiter/candidate dashboards.
- Metric cards no longer show percentage badges that were actually acceptance/completion rates rather than period-over-period trends.
- Billing and usage copy is localized and distinguishes monthly allowances from concurrent limits.
- Plan cards expose live capability state from the backend plan contract.

## Verification notes
The release does not change `.env` files or database schema/data. Local container builds should be used for the final runtime check because this packaging environment does not include the .NET SDK and cannot reach the external AI provider.
