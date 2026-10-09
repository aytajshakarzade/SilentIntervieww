# SilentInterview v47 — Dynamic Plans + Breathable UI

This release keeps the existing application and environment configuration intact while making the commercial plan contract and UI more consistent.

## Google sign-in
- The login/register surface shows only Google's official `Continue with Google` control.
- The extra title, subtitle, status dot and duplicate custom Google icon shell were removed.
- Google Identity Services remains responsible for the visible button and sign-in interaction.

## Plan entitlements
`GET /api/v1/subscription/plans?role=candidate|recruiter` is the canonical public plan contract.

Candidate:
- Free: 3 interviews/month, 10 AI actions/month, AI interview feedback, core reports.
- Go: 25 interviews/month, 100 AI actions/month, advanced analytics, priority AI.
- Pro: unlimited interviews and AI actions, advanced analytics, priority AI.

Recruiter:
- Free: 3 active jobs, 10 AI actions/month, core analytics; AI HR Assistant is locked.
- Go: 25 active jobs, 100 AI actions/month, 50 assistant messages/month, advanced analytics, priority AI.
- Pro: unlimited active jobs, AI actions, assistant messages, advanced analytics and priority AI.

These allowances are enforced server-side. The interview plan generated during creation counts as one AI action, as do report generations. Recruiter assistant messages use their own assistant-message allowance.

## UI
- Billing, profile plan card and upgrade-limit surfaces consume live plan data instead of duplicating quota constants.
- Public pricing has Candidate/Recruiter audience switching and reads the same plan endpoint.
- Authenticated content has larger gutters, softer card motion, more generous spacing and a calmer information hierarchy.
- The application shell keeps one controlled scroll area for long dashboard pages.

## Environment safety
The existing `.env` files were preserved without content changes.
