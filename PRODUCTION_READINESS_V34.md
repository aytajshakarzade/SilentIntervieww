# SilentInterview v34 — Production Hardening & UX Fixes

## Included
- Unified authentication remains in `/login`; SuperAdmin is role-routed from the same login.
- Docker Compose no longer interpolates secrets from the shell/root `.env`; the backend `.env` remains the runtime source via `env_file`.
- ASP.NET Core builds the SQL connection string from injected `DB_USER` / `DB_PASSWORD` when available.
- Google sign-in client configuration has a runtime API fallback, so frontend builds do not depend on Compose resolving `back-end/.env` for a public client id.
- Google validation errors are logged server-side without exposing credentials.
- Groq 401/403 responses are classified as authentication failures instead of leaking provider response bodies.
- AI HR Assistant has a deterministic, data-grounded fallback when the external provider rejects credentials, so the recruiter can still compare stored interview results.
- AI Assistant frontend shows a localized retry action instead of a raw HTTP/provider error.
- SuperAdmin/recruiter content scrolling is isolated to the content pane, route changes reset scroll to top, and sticky top navigation no longer creates double vertical spacing.
- Candidate rows open a premium detail drawer containing profile, resume, applications, interviews, AI score, communication, confidence, technical score, strengths, weaknesses, AI recommendation, recruiter notes, and interview timeline.
- Recruiter dashboard and application pipeline localize common application statuses (Applied, Review pending, Interviewed, Shortlisted, Accepted, Hired, Rejected, Offer sent, Archived).
- Activity timeline localizes common actions/entities and relative timestamps in Azerbaijani, English, and Russian.
- Company image upload validates file signatures in addition to MIME type and size.

## Configuration integrity
The existing `frontend/.env` and `back-end/.env` files were preserved byte-for-byte and were not edited by this release.
