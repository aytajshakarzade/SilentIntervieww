# API startup and healthcheck troubleshooting

The API liveness endpoint is intentionally handled by an early middleware path:
`GET /health/live` returns HTTP 200 without authentication, CORS, routing, database, migrations, AI, or other dependencies.

The frontend is not blocked by API health because it is a static SPA and can load while the API finishes initialization.

Useful commands:

```powershell
docker compose down
docker compose up --build -d
docker compose ps
docker logs silentinterview-api --tail 200
```

For a direct probe from Windows:

```powershell
curl.exe -i http://localhost:5000/health/live
```

Expected response: HTTP 200 and `{ "status": "ok" }`.
