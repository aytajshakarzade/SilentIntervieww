# Google workspace fix — v46

The Google recruiter onboarding bug was caused by the frontend sending the localized country display name (for example, `Argentina`) into the backend `CompanyCountry` field. The database stores `Companies.CountryCode` as a two-character ISO-3166 value, so the create operation could fail during `SaveChangesAsync` and be surfaced as a misleading workspace error.

The onboarding flow now sends the selected two-letter country code (`AR`, `AZ`, etc.), validates it server-side, and matches existing workspaces by normalized company name + country code.

The Google button remains the official Google Identity Services standard button with `continue_with`, a maximum 400px width, left-aligned logo, and the standard rectangular presentation.
