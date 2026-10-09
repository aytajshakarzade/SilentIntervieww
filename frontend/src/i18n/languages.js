// Supported languages for the whole app. Adding a new language means:
//   1. add an entry here
//   2. add a matching dictionary file in src/i18n/locales/
//   3. register it in src/i18n/locales/index.js
export const LANGUAGES = Object.freeze({
  az: { code: 'az', label: 'Azərbaycan', flag: '🇦🇿' },
  en: { code: 'en', label: 'English', flag: '🇬🇧' },
  ru: { code: 'ru', label: 'Русский', flag: '🇷🇺' },
});

export const DEFAULT_LANGUAGE = 'en';
export const SUPPORTED_LANGUAGE_CODES = Object.keys(LANGUAGES);

// Picks the best starting language from the browser locale, falling back to
// English if the browser reports something we don't support.
// IMPORTANT: This should only be used if there's no stored language preference.
export function detectBrowserLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const raw of candidates) {
    if (!raw) continue;
    const short = raw.slice(0, 2).toLowerCase();
    if (SUPPORTED_LANGUAGE_CODES.includes(short)) return short;
  }

  return DEFAULT_LANGUAGE;
}
