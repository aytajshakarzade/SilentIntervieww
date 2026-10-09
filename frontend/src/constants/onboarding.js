// Tour step definitions, keyed by role. Each step targets an element via
// a `data-tour="<id>"` attribute placed on that element in the app.
// An optional `route` tells the tour to navigate there first (for
// page-specific targets like the Create Job button or the pipeline board).
// Step copy (title/what/why/next/tip) lives in the i18n locale files under
// `onboarding.recruiter.<id>` / `onboarding.candidate.<id>` so the tour
// follows the shared language provider — this file only holds the
// structural (non-visible-text) parts of each step.
export const ONBOARDING_STORAGE_PREFIX = 'onboarding:';

// Bump this whenever the tour content changes meaningfully (new steps,
// materially different flow, etc). Every existing user — regardless of
// whether they've already completed an older version — will automatically
// see the tour once more the next time they log in, because their stored
// version will be lower than this one. See useOnboarding.js.
export const ONBOARDING_VERSION = 6;

// Rough reading + interacting time per step, used to show an estimate up front.
export const SECONDS_PER_STEP = 14;

export const RECRUITER_TOUR_STEPS = [
  // ── Navigation & global shell ──────────────────────────────────────────
  { id: 'dashboard',     target: 'nav-dashboard',     route: '/recruiter/dashboard',    placement: 'right' },
  { id: 'sidebar',       target: 'sidebar-nav',                                         placement: 'right' },
  { id: 'notifications', target: 'nav-notifications', route: '/recruiter/notifications', placement: 'right' },
  // ── Jobs ───────────────────────────────────────────────────────────────
  { id: 'jobs',          target: 'nav-jobs',           route: '/recruiter/jobs',         placement: 'right' },
  { id: 'create-job',    target: 'create-job-btn',     route: '/recruiter/jobs',         placement: 'bottom' },
  // ── Candidates & Pipeline ──────────────────────────────────────────────
  { id: 'candidates',    target: 'nav-candidates',     route: '/recruiter/candidates',   placement: 'right' },
  { id: 'applications',  target: 'nav-applications',   route: '/recruiter/applications', placement: 'right' },
  { id: 'application-search', target: 'applications-search', route: '/recruiter/applications', placement: 'bottom' },
  // ── Interviews ─────────────────────────────────────────────────────────
  { id: 'interviews',    target: 'nav-interviews',     route: '/recruiter/interviews',   placement: 'right' },
  // ── AI Features ────────────────────────────────────────────────────────
  { id: 'ai-assistant',  target: 'ai-hr-fab',              placement: 'left' },
  { id: 'ai-compare',    target: 'nav-ai-compare',     route: '/recruiter/ai/compare',   placement: 'right' },
  { id: 'ai-compare-picker', target: 'ai-compare-picker', route: '/recruiter/ai/compare', placement: 'bottom' },
  // ── Analytics & Reports ────────────────────────────────────────────────
  { id: 'analytics',     target: 'nav-analytics',      route: '/recruiter/analytics',    placement: 'right' },
  { id: 'analytics-charts', target: 'analytics-charts', route: '/recruiter/analytics',   placement: 'top' },
  // ── Profile & Settings ─────────────────────────────────────────────────
  { id: 'profile',       target: 'nav-profile',        route: '/recruiter/profile',      placement: 'right' },
  { id: 'settings',      target: 'nav-settings',       route: '/recruiter/settings',     placement: 'right' },
];

export const CANDIDATE_TOUR_STEPS = [
  // ── Dashboard ──────────────────────────────────────────────────────────
  { id: 'dashboard',           target: 'candidate-dashboard-stats', route: '/candidate/dashboard',   placement: 'bottom' },
  { id: 'dashboard-interviews',target: 'candidate-dashboard-available', route: '/candidate/dashboard', placement: 'top' },
  // ── Navigation ─────────────────────────────────────────────────────────
  { id: 'sidebar',             target: 'sidebar-nav',                                                 placement: 'right' },
  // ── Interviews ─────────────────────────────────────────────────────────
  { id: 'interviews',          target: 'nav-interviews',             route: '/candidate/interviews',  placement: 'right' },
  { id: 'interview-list',      target: 'available-interviews-list',  route: '/candidate/interviews',  placement: 'top' },
  { id: 'interview-start',     target: 'start-interview-btn',        route: '/candidate/interviews',  placement: 'bottom' },
  // ── Results ────────────────────────────────────────────────────────────
  { id: 'results',             target: 'nav-results',                route: '/candidate/results',     placement: 'right' },
  // ── Reports ────────────────────────────────────────────────────────────
  { id: 'reports',             target: 'nav-reports',                route: '/candidate/reports',     placement: 'right' },
  { id: 'reports-list',        target: 'reports-list-header',        route: '/candidate/reports',     placement: 'bottom' },
  // ── Notifications ──────────────────────────────────────────────────────
  { id: 'notifications',       target: 'nav-notifications',          route: '/candidate/notifications', placement: 'right' },
  // ── Profile & Settings ─────────────────────────────────────────────────
  { id: 'profile',             target: 'nav-profile',                route: '/candidate/profile',     placement: 'right' },
  { id: 'settings',            target: 'nav-settings',               route: '/candidate/settings',    placement: 'right' },
];

/**
 * Merges the structural step list with translated copy from the i18n `t`
 * function. Returns steps shaped exactly as before (id, target, route,
 * placement, title, what, why, next, tip) so OnboardingTour.jsx needs no
 * changes beyond passing `t` in.
 */
export function getTourSteps(isRecruiter, t) {
  const base = isRecruiter ? RECRUITER_TOUR_STEPS : CANDIDATE_TOUR_STEPS;
  const ns = isRecruiter ? 'onboardingRecruiter' : 'onboardingCandidate';
  return base.map((step) => ({
    ...step,
    title: t(`${ns}.${step.id}.title`),
    what:  t(`${ns}.${step.id}.what`),
    why:   t(`${ns}.${step.id}.why`),
    next:  t(`${ns}.${step.id}.next`),
    tip:   t(`${ns}.${step.id}.tip`),
  }));
}

export function getEstimatedMinutes(stepCount) {
  return Math.max(1, Math.round((stepCount * SECONDS_PER_STEP) / 60));
}
