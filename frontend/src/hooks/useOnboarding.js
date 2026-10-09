import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useTranslation } from '../i18n';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  getTourSteps,
  ONBOARDING_STORAGE_PREFIX,
  ONBOARDING_VERSION,
} from '../constants/onboarding';

// A stable per-account identifier. We deliberately do NOT fall back to a
// generic 'anonymous' bucket here — if we can't yet identify the account,
// we simply wait rather than risk two different new accounts sharing one
// localStorage key (which previously caused the tutorial to be marked
// "seen" for every subsequent new user once the first one dismissed it).
function stableUserId(user) {
  return user?.id ?? user?.userId ?? user?.email ?? null;
}

// Versioned, per-user storage key: `onboarding:<userId>` — the value stored
// is the onboarding version the user has last completed (or skipped), e.g.
// `onboarding:7f3a...=2`. A brand-new user has no key at all, which reads
// as version 0 and is always lower than ONBOARDING_VERSION, so the tour
// launches. When ONBOARDING_VERSION is bumped, every existing user's stored
// version becomes stale (lower than current) and the tour auto-launches
// again — once — the next time they log in.
function storageKeyFor(userId) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

function readSeenVersion(userId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    const parsed = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSeenVersion(userId) {
  try {
    localStorage.setItem(storageKeyFor(userId), String(ONBOARDING_VERSION));
  } catch {
    /* ignore — storage may be unavailable (private mode, quota, etc) */
  }
}

/**
 * Drives the first-time / re-triggered onboarding experience.
 * Phases: 'closed' -> 'welcome' -> 'touring' -> 'success' -> 'closed'.
 *
 * - Auto-opens (starting at the welcome screen) the first time a given
 *   account is seen on this browser, tracked per-account via a versioned
 *   key: `onboarding:<userId>` = last-seen version.
 * - If the stored version is lower than ONBOARDING_VERSION (either because
 *   the user has never seen the tour, or the tour content was updated
 *   since they last saw it), the tour automatically launches once.
 * - Auto-start waits for authentication AND for the dashboard shell to
 *   have actually mounted (signalled via `markDashboardReady`, wired from
 *   AppLayout once the routed page exists) before opening, so the welcome
 *   modal never appears over a blank/loading screen.
 * - Exposes `startTour()` so it can be relaunched manually (e.g. from
 *   Settings) at any version, without touching the stored version until
 *   the user actually finishes or skips.
 * - Persists the seen version per-user in localStorage so it doesn't
 *   auto-show again until a newer version ships.
 */
export default function useOnboarding() {
  const { user, isRecruiter, isAuthenticated } = useAuth();
  const { t } = useTranslation();
  const steps = useMemo(() => getTourSteps(isRecruiter, t), [isRecruiter, t]);
  const userId = stableUserId(user);

  const [phase, setPhase] = useState('closed'); // closed | welcome | touring | success
  const [stepIndex, setStepIndex] = useState(0);
  const [checkedUserId, setCheckedUserId] = useState(null);
  const [dashboardReady, setDashboardReady] = useState(false);

  // Reset the "dashboard ready" signal whenever the account changes (e.g.
  // logout -> different user login) so the next account's auto-start also
  // waits for its own dashboard to mount rather than reusing a stale signal.
  const prevUserIdRef = useRef(userId);
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      setDashboardReady(false);
      setCheckedUserId(null);
    }
  }, [userId]);

  const markDashboardReady = useCallback(() => {
    setDashboardReady(true);
  }, []);

  // Auto-open once per (account, version) pair — only once we have a real,
  // stable identifier for the account AND the dashboard has signalled it
  // has finished its initial mount/load.
  useEffect(() => {
    if (!isAuthenticated || !userId || !dashboardReady) return;
    if (checkedUserId === userId) return;
    setCheckedUserId(userId);

    // Automatic onboarding is intentionally reserved for a newly-created
    // account. Logging in to an existing account must never interrupt the
    // user with a tour. Manual startTour() remains available from Settings.
    let isNewAccount = false;
    try {
      isNewAccount = localStorage.getItem(STORAGE_KEYS.newAccountTour) === String(userId);
      if (isNewAccount) localStorage.removeItem(STORAGE_KEYS.newAccountTour);
    } catch { /* ignore storage errors */ }

    const seenVersion = readSeenVersion(userId);
    if (isNewAccount && seenVersion < ONBOARDING_VERSION) {
      setStepIndex(0);
      setPhase('welcome');
    }
  }, [isAuthenticated, userId, dashboardReady, checkedUserId]);

  const markComplete = useCallback(() => {
    if (!userId) return;
    writeSeenVersion(userId);
  }, [userId]);

  const beginTour = useCallback(() => {
    setStepIndex(0);
    setPhase('touring');
  }, []);

  const skip = useCallback(() => {
    setPhase('closed');
    markComplete();
  }, [markComplete]);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i >= steps.length - 1) {
        setPhase('success');
        markComplete();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, markComplete]);

  const back = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const closeSuccess = useCallback(() => {
    setPhase('closed');
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setPhase('welcome');
  }, []);

  return {
    phase,
    steps,
    stepIndex,
    next,
    back,
    skip,
    beginTour,
    closeSuccess,
    startTour,
    isRecruiter,
    markDashboardReady,
  };
}
