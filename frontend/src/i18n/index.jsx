import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { DICTIONARIES } from './locales';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGE_CODES, detectBrowserLanguage } from './languages';

const LanguageContext = createContext(null);

// Returns a user-scoped storage key so Account A's language never leaks to Account B.
function languageKey(userId) {
  return userId
    ? `silent-interview.language.${userId}`
    : 'silent-interview.language.guest';
}

function readStoredLanguage(userId) {
  try {
    const stored = localStorage.getItem(languageKey(userId));
    if (stored && SUPPORTED_LANGUAGE_CODES.includes(stored)) return stored;
  } catch {
    // localStorage unavailable — fall through
  }
  return null;
}

function persistLanguage(lang, userId) {
  try {
    localStorage.setItem(languageKey(userId), lang);
  } catch {
    // ignore
  }
}

// Resolves `common.save` (or `common.save.nested`) against a dictionary object.
function resolveKey(dictionary, key) {
  return key.split('.').reduce(
    (node, segment) => (node && typeof node === 'object' ? node[segment] : undefined),
    dictionary,
  );
}

// Replaces `{placeholder}` tokens in a translated string.
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (match, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  ));
}

export function LanguageProvider({ children }) {
  // userId is null until AuthProvider notifies us via setUserId
  const [userId, setUserId] = useState(null);

  const [language, setLanguageState] = useState(
    () => readStoredLanguage(null) ?? detectBrowserLanguage() ?? DEFAULT_LANGUAGE,
  );

  // Called by AuthProvider when user logs in or out.
  // On login: load that user's stored language preference.
  // On logout: stay on the current language (don't reset; next login will load theirs).
  const onAuthChange = useCallback((nextUserId) => {
    setUserId(nextUserId);
    if (nextUserId) {
      // Load this user's saved language preference
      const saved = readStoredLanguage(nextUserId);
      if (saved) {
        setLanguageState(saved);
      }
      // If no saved preference for this user, keep the current language
      // but persist it under their key so it's stored going forward.
      else {
        persistLanguage(language, nextUserId);
      }
    }
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (!SUPPORTED_LANGUAGE_CODES.includes(next)) return;
    setLanguageState(next);
    persistLanguage(next, userId);
  }, [userId]);

  const t = useCallback((key, params) => {
    const active = DICTIONARIES[language];
    const fallback = DICTIONARIES[DEFAULT_LANGUAGE];

    const value = resolveKey(active, key) ?? resolveKey(fallback, key);

    if (value === undefined) {
      if (import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] Missing translation key: "${key}"`);
      }
      return key;
    }

    return typeof value === 'string' ? interpolate(value, params) : value;
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGE_CODES,
    onAuthChange,
  }), [language, setLanguage, t, onAuthChange]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return ctx;
}
