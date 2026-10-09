# AI setup

The application uses Groq's OpenAI-compatible API for the AI HR Assistant and AI reports.

1. Create a new API key in the Groq console.
2. Put it in `back-end/.env` as `GROQ_API_KEY=gsk_...`.
3. Do not use a revoked/old key. A key that returns HTTP 401 `invalid_api_key` cannot be repaired in application code.
4. Rebuild: `docker compose down && docker compose up --build -d`.
5. Verify: `docker logs silentinterview-api --tail 100`. The assistant health check should stop returning 503.

The frontend no longer treats provider authentication failure as missing interview data; it shows the provider error instead. Existing conversation history may still contain older fallback messages; those are historical messages, not evidence that current database data is missing.
