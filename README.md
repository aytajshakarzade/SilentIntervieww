# SilentInterview v24 — Clean Production Baseline

A cleaned baseline of the SilentInterview SaaS application. The previous nested v19/v22 directory structure has been removed.

## Included
- React 19 + Vite frontend
- ASP.NET Core 9 backend
- Candidate / Recruiter / SuperAdmin roles (1 / 2 / 3)
- Recruiter company selection during signup
- Google and email authentication flows
- Floating AI HR assistant
- SuperAdmin control center
- Subscription and AI usage limits
- Docker Compose deployment
- Persistent company-logo storage volume
- Production Swagger restriction
- GitHub CI build checks

## Important
The existing `back-end/.env` is intentionally preserved. Do not commit real production secrets to source control.

## Run
```powershell
cd back-end
docker compose down
docker compose up --build -d
```

Frontend: http://localhost:3000
API: http://localhost:5000
