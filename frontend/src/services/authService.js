/**
 * authService — single authority for authentication state.
 *
 * Consolidates: authApi + authenticationService + authService (3 layers → 1).
 *
 * Backend DTOs:
 *   POST /Auth/login    → ApiResponse<AuthResponse>
 *   POST /Auth/register → ApiResponse<bool>
 *   POST /Auth/refresh  → ApiResponse<RefreshTokenResponse>  { accessToken, refreshToken }
 *   POST /Auth/logout   → ApiResponse<bool>
 *
 * AuthResponse: { userId, fullName, email, role, accessToken, refreshToken,
 *                 accessTokenExpiresAt, refreshTokenExpiresAt }
 *
 * All API routes include the v1 URL segment (for example, /api/v1/Auth/login).
 */
import axios from 'axios';
import { authApi } from '../api/authApi';
import { STORAGE_KEYS } from '../constants/storageKeys';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const raw = axios.create({ baseURL: BASE_URL, timeout: 20_000, withCredentials: true });

// ─── In-memory + persisted snapshot ─────────────────────────────────────────

let snapshot = null;
const persistedUser = _readStorage();
const listeners = new Set();

function _readStorage() {
  try { const s = localStorage.getItem(STORAGE_KEYS.auth); return s ? JSON.parse(s) : null; }
  catch { return null; }
}

function _safePersistedSnapshot(next) {
  if (!next) return null;
  return {
    userId: next.userId,
    fullName: next.fullName,
    email: next.email,
    role: next.role,
    plan: next.plan,
    companyId: next.companyId,
    accessTokenExpiresAt: next.accessTokenExpiresAt,
  };
}

function _commit(next) {
  snapshot = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(_safePersistedSnapshot(next)));
    else localStorage.removeItem(STORAGE_KEYS.auth);
  } catch { }
  listeners.forEach(fn => fn(snapshot));
}

// A refresh-token cookie restores the session after a full page reload.
// The refresh token itself is intentionally never persisted in browser storage.
if (persistedUser?.userId && persistedUser?.role) {
  snapshot = persistedUser;
}


// ─── Token accessors used by axiosClient ────────────────────────────────────

export const getAccessToken = () => snapshot?.accessToken ?? null;
export const getRefreshToken = () => snapshot?.refreshToken ?? null;
export const getAuthSnapshot = () => snapshot;

/**
 * Called by axiosClient after a successful token refresh.
 * Backend RefreshTokenResponse returns { accessToken, refreshToken }.
 * We merge those into the existing snapshot so the user object is preserved.
 */
export function replaceTokens({ accessToken, refreshToken }) {
  if (!snapshot || !accessToken) return;
  _commit({ ...snapshot, accessToken, refreshToken });
}

export function clearAuth() {
  _commit(null);
}

// ─── User model ──────────────────────────────────────────────────────────────

/**
 * Maps backend AuthResponse → frontend User object.
 * role is normalised to UPPERCASE so all checks use 'RECRUITER' / 'CANDIDATE' / 'SUPERADMIN'.
 */
function toUser(auth) {
  if (!auth) return null;

  return {
    id: auth.userId,
    name: auth.fullName,
    email: auth.email,
    role: String(auth.role ?? '').toUpperCase(),
    plan: String(auth.plan ?? 'Free'),
    companyId: auth.companyId,
    accessTokenExpiresAt: auth.accessTokenExpiresAt,
  };
}
export const getUser = () => toUser(snapshot);

export function subscribeToAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _unwrap(res) {
  const p = res.data;
  if (p?.success === false) throw new Error(p.message || 'Authentication failed.');
  return p?.data ?? p;
}

// ─── Auth operations ─────────────────────────────────────────────────────────

export async function hydrateAuth() {
  try {
    const response = await raw.post('/Auth/refresh', {}, { withCredentials: true });
    const auth = _unwrap(response);
    _commit(auth);
    return toUser(auth);
  } catch {
    clearAuth();
    return null;
  }
}

export async function login({ email, password }) {
  try {
    const response = await raw.post("/Auth/login", {
      email,
      password,
    });

    const auth = _unwrap(response);
    _commit(auth);

    return toUser(auth);
  } catch (err) {
    // Preserve the original Axios error so getErrorMessage can access response data
    // Only throw a new Error if we have specific validation errors to format
    const data = err.response?.data;

    if (data?.errors) {
      // Attach the original error to preserve context
      const error = new Error(
        Object.values(data.errors)
          .flat()
          .join("\n")
      );
      error.originalError = err;
      error.response = err.response;
      throw error;
    }

    // For all other cases, preserve the original error structure
    // so getErrorMessage can access response.status, response.data, etc.
    if (err.response) {
      // It's an Axios error with response data - preserve it as-is
      throw err;
    }

    // Network or other errors - preserve as-is
    throw err;
  }
}

export async function register({
  fullName,
  email,
  password,
  confirmPassword,
  role = "Candidate",
  companyId = null,
  companyName = null,
  companyCountry = null,
  companyIndustry = null,
  companyWebsite = null,
}) {
  try {
    const response = await raw.post("/Auth/register", {
      fullName,
      email,
      password,
      confirmPassword: confirmPassword || password,
      role,
      companyId,
      companyName,
      companyCountry,
      companyIndustry,
      companyWebsite,
    });

    return _unwrap(response);
  } catch (err) {
    // Preserve the original Axios error so getErrorMessage can access response data
    const data = err.response?.data;

    if (data?.errors) {
      const error = new Error(
        Object.values(data.errors)
          .flat()
          .join("\n")
      );
      error.originalError = err;
      error.response = err.response;
      throw error;
    }

    // Preserve the original error structure for all other cases
    if (err.response) {
      throw err;
    }

    throw err;
  }
}


export async function loginWithGoogle(credential, role = null, companyId = null, companyName = null, companyCountry = null, companyIndustry = null, setupToken = null) {
  const auth = await authApi.google(credential, role, companyId, companyName, companyCountry, companyIndustry, setupToken);
  if (auth?.requiresSetup) return auth;
  _commit(auth);
  return toUser(auth);
}

export async function forgotPassword(email) {
  return authApi.forgotPassword(email);
}

export async function resetPassword(payload) {
  return authApi.resetPassword(payload);
}

export async function logout() {
  const accessToken = getAccessToken();
  try {
    if (accessToken) {
      await raw.post('/Auth/logout', {}, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  } finally {
    _commit(null);
    // Clear AI assistant chat history to prevent cross-user data leakage
    try {
      localStorage.removeItem('ai-hr-assistant-chat-history');
    } catch {
      // Ignore storage errors
    }
    // Clear any cached conversation data
    try {
      localStorage.removeItem('ai-active-conversation');
    } catch {
      // Ignore storage errors
    }
  }
}
