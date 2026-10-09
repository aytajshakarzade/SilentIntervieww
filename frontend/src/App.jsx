import { lazy, Suspense, useMemo, useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, Skeleton, Stack } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import createAppTheme from './theme/index';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './i18n';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ROUTES, getRoleBase } from './constants/routes';
import { STORAGE_KEYS } from './constants/storageKeys';
import SilentInterviewEngine from './features/silentInterview/SilentInterviewEngine';

// Layouts
import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';

// Guards
import ProtectedRoute from './components/auth/ProtectedRoute';
import GuestRoute from './components/auth/GuestRoute';

// Eager public pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import GoogleAccountSetupPage from './pages/GoogleAccountSetupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import BillingPage from './pages/BillingPage';

// Error pages (tiny, always needed)
import { NotFoundPage, UnauthorizedPage, ForbiddenPage } from './pages/errors/ErrorPages';

// Lazy-loaded pages — code-split per route
const ApplicationsPage = lazy(() =>
  import("./pages/applications/ApplicationsPage")
);
const RecruiterDashboard = lazy(() => import('./pages/dashboard/RecruiterDashboard'));
const CandidateDashboard = lazy(() => import('./pages/dashboard/CandidateDashboard'));
const JobsPage = lazy(() => import('./pages/jobs/JobsPage'));
const CandidatesPage = lazy(() => import('./pages/candidates/CandidatesPage'));
const RecruiterInterviews = lazy(() => import('./pages/recruiter/InterviewsPage'));
const CandidateComparisonPage = lazy(() => import('./pages/recruiter/CandidateComparisonPage'));
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const RecruiterProfilePage = lazy(() => import('./pages/profile/RecruiterProfilePage'));
const AvailableInterviews = lazy(() => import('./pages/interviews/AvailableInterviewsPage'));
const AIInterviewRoomPage = lazy(() => import('./pages/interviews/AIInterviewRoomPage'));
const ResultPage = lazy(() => import('./pages/interviews/ResultPage'));
const ReportsListPage = lazy(() => import('./pages/interviews/ReportsListPage'));
const ReportViewerPage = lazy(() => import('./pages/interviews/ReportViewerPage'));
const CandidateProfilePage = lazy(() => import('./pages/profile/CandidateProfilePage'));
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));
const SuperAdminProfilePage = lazy(() => import('./pages/superadmin/SuperAdminProfilePage'));
const SuperAdminSettingsPage = lazy(() => import('./pages/superadmin/SuperAdminSettingsPage'));

// ─── Page loading fallback ────────────────────────────────────────────────────
function PageLoader() {
  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: 3, minHeight: '60vh' }}>
      <Skeleton width={220} height={48} sx={{ mb: 2 }} />
      <Stack spacing={2}><Skeleton variant="rounded" height={130} /><Skeleton variant="rounded" height={320} /></Stack>
    </Box>
  );
}

// ─── "/" redirect — sends user to the right dashboard or login ────────────────
function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace />;
  return <Navigate to={getRoleBase(user?.role)} replace />;
}

// ─── Settings wrappers (pass colorMode props) ─────────────────────────────────
const makeSettingsWrapper = (props) => () => <SettingsPage {...props} />;

// ─── Inner router — has access to AuthContext ─────────────────────────────────
function Router({ colorMode, toggleColorMode }) {
  const layoutProps = { colorMode, toggleColorMode };
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelector('[data-app-scroll]')?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        {/* Public / guest-only */}
        <Route element={<PublicLayout colorMode={colorMode} toggleColorMode={toggleColorMode} />}>
          <Route path={ROUTES.LOGIN} element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path={ROUTES.REGISTER} element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/auth/google/setup" element={<GuestRoute><GoogleAccountSetupPage /></GuestRoute>} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
        </Route>

        {/*  Landing Page */}
        <Route path={ROUTES.HOME} element={<SilentInterviewEngine />} />
        {/* ── SuperAdmin area: dedicated control-center pages ── */}
        <Route
          path="/superadmin"
          element={
            <ProtectedRoute roles={['SUPERADMIN']}>
              <AppLayout {...layoutProps} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard section="overview" />} />
          <Route path="users" element={<SuperAdminDashboard section="users" />} />
          <Route path="companies" element={<SuperAdminDashboard section="companies" />} />
          <Route path="billing" element={<SuperAdminDashboard section="billing" />} />
          <Route path="activity" element={<SuperAdminDashboard section="activity" />} />
          <Route path="system" element={<SuperAdminDashboard section="system" />} />
          <Route path="profile" element={<SuperAdminProfilePage />} />
          <Route path="settings" element={<SuperAdminSettingsPage colorMode={colorMode} toggleColorMode={toggleColorMode} />} />
        </Route>

        {/* ── Recruiter area ─────────────────────────────────── */}
        <Route
          path="/recruiter"
          element={
            <ProtectedRoute roles={['RECRUITER']}>
              <AppLayout {...layoutProps} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={ROUTES.RECRUITER_DASHBOARD} replace />} />
          <Route path="dashboard" element={<RecruiterDashboard />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="candidates" element={<CandidatesPage />} />

          <Route
            path="applications"
            element={<ApplicationsPage />}
          />

          <Route path="interviews" element={<RecruiterInterviews />} />
          <Route path="ai/compare" element={<CandidateComparisonPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage colorMode={colorMode} toggleColorMode={toggleColorMode} />} />
          <Route path="profile" element={<RecruiterProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>

        {/* ── Candidate area ─────────────────────────────────── */}
        <Route
          path="/candidate"
          element={
            <ProtectedRoute roles={['CANDIDATE']}>
              <AppLayout {...layoutProps} />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={ROUTES.CANDIDATE_INTERVIEWS} replace />} />
          <Route path="dashboard" element={<CandidateDashboard />} />
          <Route path="interviews" element={<AvailableInterviews />} />
          <Route path="interviews/:id" element={<AIInterviewRoomPage />} />
          <Route path="results" element={<ResultPage />} />
          <Route path="reports" element={<ReportsListPage />} />
          <Route path="reports/:id" element={<ReportViewerPage />} />
          <Route path="profile" element={<CandidateProfilePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<SettingsPage colorMode={colorMode} toggleColorMode={toggleColorMode} />} />
        </Route>

        <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
        <Route path="/billing/success" element={<ProtectedRoute><BillingPage success /></ProtectedRoute>} />

        {/* Error pages */}
        <Route path={ROUTES.UNAUTHORIZED} element={<UnauthorizedPage />} />
        <Route path={ROUTES.FORBIDDEN} element={<ForbiddenPage />} />
        <Route path={ROUTES.NOT_FOUND} element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />

      </Routes>
    </Suspense>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [colorMode, setColorMode] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.theme) ?? 'light'; }
    catch { return 'light'; }
  });

  const toggleColorMode = useCallback(() => {
    setColorMode(m => {
      const next = m === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(STORAGE_KEYS.theme, next); } catch { }
      return next;
    });
  }, []);

  const theme = useMemo(() => createAppTheme(colorMode), [colorMode]);

  return (
    <LanguageProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
          }}
        />
        <ErrorBoundary>
          <AuthProvider>
            <Router colorMode={colorMode} toggleColorMode={toggleColorMode} />
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
      </LanguageProvider>
  );
}
