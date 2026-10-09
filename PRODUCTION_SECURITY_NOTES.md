# SilentInterview — Production Security Notes

## Authentication
- All roles use the single `/login` page. The backend role determines the destination. There is no separate SuperAdmin login page.
- SuperAdmin access remains protected server-side with `[Authorize(Roles = "SuperAdmin")]`.
- Refresh tokens are stored in an HttpOnly cookie and are not persisted in localStorage.
- Access/refresh token rotation remains enabled.
- Authentication endpoints are rate-limited.

## Before deployment
1. Fill `back-end/.env` with your real local/deployment values, or use your secret manager.
2. Never commit API keys, DB passwords, JWT keys, Stripe secrets, or SuperAdmin passwords.
3. Use HTTPS in production and set `Auth__RefreshCookieSecure=true`.
4. If frontend/API are cross-site in production, set `Auth__RefreshCookieSameSite=None`.
5. Set `Cors__AllowedOrigins__0` to the exact production frontend origin(s); do not use `*` with credentials.
6. Configure SMTP before enabling password-reset/verification email flows.
7. Rotate any credentials that were previously committed to a repository.

## Existing SuperAdmin
If the SuperAdmin account already exists in your database, nothing needs to be recreated. Log in through the normal `/login` page with that account.
