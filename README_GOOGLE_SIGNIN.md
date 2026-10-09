# Google Sign-In setup

SilentInterview uses Google Identity Services for the browser button and verifies the returned ID token on the API.

For local Docker development, Google Cloud must allow the exact JavaScript origin used by the browser, for example `http://localhost:3000`. Google documents that an `origin_mismatch` occurs when the host/port does not match an authorized JavaScript origin.

The API accepts the web client id from `Google__ClientId` / `VITE_GOOGLE_CLIENT_ID` and never trusts a client-provided email. Existing accounts sign in immediately; first-time users receive a short-lived signed setup ticket so the setup step does not verify the same Google ID token twice.
