import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import {
  clearAuth,
  getUser,
  login  as loginFn,
  loginWithGoogle as googleLoginFn,
  logout as logoutFn,
  register as registerFn,
  forgotPassword,
  resetPassword,
  hydrateAuth,
  subscribeToAuth,
} from '../services/authService';
import { useTranslation } from '../i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Initialise synchronously from localStorage — no flicker
  const [user,    setUser]    = useState(() => getUser());
  const [loading, setLoading] = useState(true);

  // Get LanguageProvider's auth-change callback — this is safe because
  // AuthProvider is rendered *inside* LanguageProvider in App.jsx.
  const { onAuthChange } = useTranslation();

  // Stay in sync with token refreshes or changes in other tabs
  useEffect(() => {
    const unsub = subscribeToAuth(() => {
      const nextUser = getUser();
      setUser(nextUser);
    });
    return unsub;
  }, []);

  // Restore the session from the HttpOnly refresh-token cookie after a full reload.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const restored = await hydrateAuth();
        if (active && restored?.id) {
          setUser(restored);
          onAuthChange(restored.id);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [onAuthChange]);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const nextUser = await loginFn(credentials);
      setUser(nextUser);
      // Notify language provider — will load this user's stored language preference
      if (nextUser?.id) {
        onAuthChange(nextUser.id);
      }
      return nextUser;
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  const googleLogin = useCallback(async (credential, role = null, companyId = null, companyName = null, companyCountry = null, companyIndustry = null, setupToken = null) => {
    setLoading(true);
    try {
      const result = await googleLoginFn(credential, role, companyId, companyName, companyCountry, companyIndustry, setupToken);
      if (result?.requiresSetup) return result;
      setUser(result);
      if (result?.id) onAuthChange(result.id);
      return result;
    } finally { setLoading(false); }
  }, [onAuthChange]);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      await registerFn(payload);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutFn();
      setUser(null);
      // Notify language provider that no user is active
      onAuthChange(null);
      // Clear AI assistant chat history to prevent cross-user data leakage
      try {
        localStorage.removeItem('ai-hr-assistant-chat-history');
      } catch {
        // Ignore storage errors
      }
    } finally {
      setLoading(false);
    }
  }, [onAuthChange]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    isRecruiter: user?.role === 'RECRUITER',
    isCandidate: user?.role === 'CANDIDATE',
    isSuperAdmin: user?.role === 'SUPERADMIN',
    login,
    register,
    googleLogin,
    forgotPassword,
    resetPassword,
    logout,
  }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
