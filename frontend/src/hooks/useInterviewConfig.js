/**
 * useInterviewConfig — fetches the canonical interview configuration once and
 * normalizes every response shape. The UI must never end up with empty option
 * arrays just because the API is temporarily unavailable or returns an
 * unexpected casing/envelope.
 */
import { useState, useEffect } from 'react';
import { aiInterviewService } from '../services/aiInterviewService';

export const DEFAULT_INTERVIEW_CONFIG = Object.freeze({
  experienceLevels: ['Junior', 'Mid', 'Senior', 'Lead', 'Staff', 'Principal'],
  difficultyLevels: ['easy', 'medium', 'hard'],
  supportedLanguages: [
    { value: 'en', label: 'English' },
    { value: 'az', label: 'Azərbaycan dili' },
    { value: 'ru', label: 'Русский' },
  ],
  estimatedDurations: [15, 20, 30, 45, 60],
});

let _configCache = null;
let _configPromise = null;

const nonEmptyArray = (value, fallback) =>
  Array.isArray(value) && value.length > 0 ? value : fallback;

function normalizeConfig(data) {
  const raw = data?.data ?? data ?? {};

  const experienceLevels = nonEmptyArray(
    raw.experienceLevels ?? raw.ExperienceLevels,
    DEFAULT_INTERVIEW_CONFIG.experienceLevels,
  );

  const difficultyLevels = nonEmptyArray(
    raw.difficultyLevels ?? raw.DifficultyLevels,
    DEFAULT_INTERVIEW_CONFIG.difficultyLevels,
  );

  const rawLanguages = nonEmptyArray(
    raw.supportedLanguages ?? raw.SupportedLanguages,
    DEFAULT_INTERVIEW_CONFIG.supportedLanguages,
  );

  const supportedLanguages = rawLanguages
    .map((language) => {
      if (typeof language === 'string') {
        return { value: language, label: language };
      }
      const value = language?.value ?? language?.Value;
      const label = language?.label ?? language?.Label;
      return value ? { value, label: label || value } : null;
    })
    .filter(Boolean);

  return {
    experienceLevels,
    difficultyLevels,
    supportedLanguages: supportedLanguages.length
      ? supportedLanguages
      : DEFAULT_INTERVIEW_CONFIG.supportedLanguages,
    estimatedDurations: nonEmptyArray(
      raw.estimatedDurations ?? raw.EstimatedDurations,
      DEFAULT_INTERVIEW_CONFIG.estimatedDurations,
    ),
  };
}

function fetchConfig() {
  if (_configCache) return Promise.resolve(_configCache);
  if (_configPromise) return _configPromise;

  _configPromise = aiInterviewService.getConfig()
    .then((data) => {
      const normalized = normalizeConfig(data);
      _configCache = normalized;
      return normalized;
    })
    .catch((error) => {
      console.warn('AI interview config unavailable; using local defaults.', error);
      const normalized = normalizeConfig(null);
      _configCache = normalized;
      return normalized;
    })
    .finally(() => {
      _configPromise = null;
    });

  return _configPromise;
}

export function useInterviewConfig() {
  const [config, setConfig] = useState(_configCache ?? DEFAULT_INTERVIEW_CONFIG);
  const [loading, setLoading] = useState(!_configCache);

  useEffect(() => {
    let active = true;
    fetchConfig().then((data) => {
      if (!active) return;
      setConfig(normalizeConfig(data));
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  return { config, loading };
}
