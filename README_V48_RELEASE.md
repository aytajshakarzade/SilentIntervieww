# SilentInterview v48 — Dynamic Plans + Airy UI

## Google sign-in
- The auth UI shows only a clean `Continue with Google` button with the Google mark.
- Login uses the normal sign-in context; registration uses the signup context.
- The official Google Identity Services button remains the actual click target behind the stable visual control.
- No extra Google title/subtitle/secure-sign-in copy is rendered.

## Commercial plans
The backend `PlanLimits` policy is the source of truth and the frontend consumes `/api/v1/subscription/plans?role=...`.

### Candidate
- Free: 3 interviews/month, 10 AI actions/month, AI interview feedback and core reports.
- Go: 25 interviews/month, 100 AI actions/month, advanced analytics and priority AI.
- Pro: unlimited interviews and AI actions, advanced analytics and priority AI.

### Recruiter
- Free: 3 active jobs, 10 AI actions/month, core recruiter tools and analytics; AI HR Assistant is locked.
- Go: 25 active jobs, 100 AI actions/month, AI HR Assistant, 50 assistant messages/month, advanced analytics and priority AI.
- Pro: unlimited active jobs, AI actions and assistant messages, advanced analytics and priority AI.

Usage endpoints return the effective plan and live counters. Session creation, AI plan/report generation, job creation and recruiter advanced analytics enforce the same limits.

## UI
- Billing/profile/upgrade cards consume the live plan contract rather than independent quota constants.
- Public pricing switches between Candidate and Recruiter using the same backend plan contract.
- SuperAdmin billing cards read plan prices/capabilities from the live plan endpoint.
- Dashboard spacing, card padding, tables, forms and grid gaps were increased so the application reads as a spacious product rather than a dense admin panel.
- Candidate interview grids and recruiter/candidate dashboard grids use wider gutters.

## Configuration
- `.env` files are intentionally preserved and not rewritten by this release.
