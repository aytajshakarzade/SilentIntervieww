SilentInterview v47 focuses on one commercial source of truth and a more breathable UI.

Plans: Free / Go / Pro are returned by GET /api/v1/subscription/plans?role=recruiter|candidate.
Free candidates: 3 interviews/month, 10 AI actions/month, AI interview feedback, core reports.
Free recruiters: 3 active jobs, 10 AI actions/month, core recruiter tools; AI HR Assistant is disabled.
Go: 25 active jobs or interviews/month by role, 100 AI actions/month, advanced analytics, priority AI; recruiters also get 50 assistant messages/month.
Pro: unlimited metered resources, advanced analytics, priority AI, and unlimited recruiter assistant messages.

The frontend should use the endpoint for pricing/billing/profile surfaces rather than hard-coded quotas.
