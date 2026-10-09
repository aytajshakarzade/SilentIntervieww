# SilentInterview v35 — Production Readiness

## Fixed from v34
- Docker API healthcheck now probes IPv4 loopback (`127.0.0.1`) with a bounded timeout and a longer startup grace period.
- Added `/health/live` liveness endpoint.
- AI provider client can automatically route an existing OpenRouter credential (including legacy credentials stored under `GROQ_API_KEY`) to OpenRouter without changing `.env`.
- Groq credentials continue to use the existing Groq endpoint.
- OpenRouter-compatible requests add a harmless `X-Title` header.
- Cleaned two C# hiding warnings and one nullable warning.

## Important
If the provider credential itself is revoked/expired/invalid, no application code can make that credential valid. In that case the existing `.env` value must eventually be replaced with a valid credential; this release does not modify it.

## Run
```powershell
docker compose down
docker compose up --build -d
docker compose ps
docker compose logs api --tail=120
```

## Health
- `http://localhost:5000/health/live` should return HTTP 200.
- `http://localhost:5000/health` should return HTTP 200 when the API is alive.
