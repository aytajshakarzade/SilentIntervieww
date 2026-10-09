# SilentInterview V28 — Dynamic Premium UI

This build focuses on interaction reliability and responsive premium polish.

## Reliability fixes
- Top navigation search is a real clickable control and opens a keyboard-friendly command palette.
- Theme toggle is a real control and persists via the existing `silent-interview.theme` storage key.
- Language switcher is a real IconButton on the app shell and keeps the existing shared AZ/EN/RU context.
- Profile and notification controls remain clickable and routable.
- App shell topbar has an explicit high z-index and pointer-event safety so decorative ambient layers cannot block clicks.
- Login and registration "Back to home" controls are above decorative layers and route directly to `/`.
- Public/auth pages expose a small theme control as well.

## Dynamic visual layer
- Ambient orbs and rings respond subtly to pointer movement.
- Existing reduced-motion behavior is preserved.
- Hover/focus micro-interactions use the existing MUI + Framer Motion stack.
- The layout remains responsive on mobile, tablet, and desktop.

## Environment
Existing `.env` files were preserved without content changes.
