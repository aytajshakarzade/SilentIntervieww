export const ROUTES = {
  // Public
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',

  // Recruiter
  RECRUITER_DASHBOARD: '/recruiter/dashboard',
  RECRUITER_JOBS: '/recruiter/jobs',
  RECRUITER_CANDIDATES: '/recruiter/candidates',
  RECRUITER_INTERVIEWS: '/recruiter/interviews',
  RECRUITER_ANALYTICS: '/recruiter/analytics',
  RECRUITER_SETTINGS: '/recruiter/settings',
  RECRUITER_PROFILE: '/recruiter/profile',
  RECRUITER_NOTIFICATIONS: '/recruiter/notifications',
  RECRUITER_APPLICATIONS:
    "/recruiter/applications",
  RECRUITER_AI_COMPARE: '/recruiter/ai/compare',

  // SuperAdmin
  SUPERADMIN_DASHBOARD: '/superadmin/dashboard',
  SUPERADMIN_PROFILE: '/superadmin/profile',
  SUPERADMIN_SETTINGS: '/superadmin/settings',

  // Candidate
  CANDIDATE_DASHBOARD: '/candidate/dashboard',
  CANDIDATE_INTERVIEWS: '/candidate/interviews',
  CANDIDATE_INTERVIEW: '/candidate/interviews/:id',
  CANDIDATE_RESULTS: '/candidate/results',
  CANDIDATE_REPORTS: '/candidate/reports',
  CANDIDATE_SETTINGS: '/candidate/settings',
  CANDIDATE_PROFILE: '/candidate/profile',
  CANDIDATE_NOTIFICATIONS: '/candidate/notifications',

  // Errors
  NOT_FOUND: '/404',
  UNAUTHORIZED: '/unauthorized',
  FORBIDDEN: '/forbidden',
};

export const getRoleBase = (role) => {
  switch (String(role).toUpperCase()) {
    case 'RECRUITER':
      return ROUTES.RECRUITER_DASHBOARD;
    case 'SUPERADMIN':
      return ROUTES.SUPERADMIN_DASHBOARD;
    case 'CANDIDATE':
    default:
      return ROUTES.CANDIDATE_INTERVIEWS;
  }
};
