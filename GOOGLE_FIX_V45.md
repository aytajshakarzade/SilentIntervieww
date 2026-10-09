# Google Fix v45

- Removed duplicate custom Google logo; the only logo is the Google-rendered sign-in mark inside the official GIS button.
- Render uses a pill/centered official GIS button and explicitly cancels stale GSI UI before/after rendering.
- Google onboarding reuses existing workspaces case-insensitively, including soft-deleted workspaces, avoiding unique-name conflicts.
- Selected company IDs are checked with IgnoreQueryFilters and soft-deleted records are restored.
- Setup submit is guarded against concurrent duplicate clicks.
- .env files were preserved byte-for-byte from v44.
