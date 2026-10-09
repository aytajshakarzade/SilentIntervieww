# SilentInterview v49 — dashboard analytics resilience

- Added plan-neutral core analytics endpoint for dashboards.
- Advanced analytics remains plan-gated.
- Dashboard no longer fails when a 402 is returned by advanced analytics.
- Global 402 toast spam is suppressed so plan-limit UI can be contextual.
- Paid plans remain effective when billing period end is temporarily unknown; only an explicitly expired period downgrades to Free.
