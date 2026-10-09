import { useEffect, useRef, useState } from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import TopNav  from './TopNav';
import OnboardingTour from '../onboarding/OnboardingTour';
import useOnboarding from '../../hooks/useOnboarding';
import { ROUTES, getRoleBase } from '../../constants/routes';
import FloatingAIHRAssistant from '../ai/FloatingAIHRAssistant';
import AmbientField from '../design/AmbientField';

export default function AppLayout({ colorMode, toggleColorMode }) {
  const theme    = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const onboarding = useOnboarding();
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef(null);

  const goDashboard = () => {
    onboarding.closeSuccess();
    navigate(getRoleBase(onboarding.isRecruiter ? 'RECRUITER' : 'CANDIDATE'));
  };

  const goPrimaryCta = () => {
    onboarding.closeSuccess();
    navigate(onboarding.isRecruiter ? ROUTES.RECRUITER_JOBS : ROUTES.CANDIDATE_INTERVIEWS);
  };

  // The app shell owns scrolling. Lock the document itself so the browser
  // scrollbar never competes with the inner dashboard scrollbar (most visible
  // on long SuperAdmin pages). Public/auth pages are unaffected because this
  // component is only mounted for authenticated app routes.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  // Keep route transitions deterministic: when switching between long
  // SuperAdmin/recruiter sections, the previous scroll position must not be
  // carried into the new page. This was the source of the 'stuck in the middle'
  // feeling on the SuperAdmin control center.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  // Signal to the onboarding hook once the routed page has actually
  // finished its own initial data load, so the welcome modal never opens
  // over a blank/skeleton screen. Pages show a loading state via MUI
  // <Skeleton> while fetching; once that skeleton is gone from the DOM
  // (replaced by real content) the page is considered "loaded". This is
  // generic across every dashboard/landing page, so it works without
  // wiring each page individually, and it naturally still works if a
  // page has no loading state at all (nothing to wait for → ready
  // immediately on next check).
  useEffect(() => {
    const { markDashboardReady } = onboarding;
    let cancelled = false;
    let rafId = null;
    let settledFrames = 0;

    const check = () => {
      if (cancelled) return;
      const el = mainRef.current;
      const stillLoading = el ? el.querySelector('.MuiSkeleton-root') : true;

      if (!stillLoading) {
        // Require two consecutive stable frames with no skeleton so we
        // don't fire on a transient gap between an initial skeleton
        // unmounting and a subsequent one mounting (e.g. two sequential
        // fetches on the same page).
        settledFrames += 1;
        if (settledFrames >= 2) {
          markDashboardReady();
          return;
        }
      } else {
        settledFrames = 0;
      }
      rafId = requestAnimationFrame(check);
    };

    rafId = requestAnimationFrame(check);

    // Absolute fallback: never block onboarding forever if a page's
    // loading state doesn't resolve or use <Skeleton> at all.
    const fallback = setTimeout(() => {
      if (!cancelled) markDashboardReady();
    }, 6000);

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(fallback);
    };
    // Re-run whenever the account identity changes, mirrored inside the
    // hook itself; markDashboardReady is stable (useCallback with no deps).
  }, [onboarding.markDashboardReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: '100dvh', minHeight: '100vh', overflow: 'hidden', bgcolor: 'background.default', backgroundImage: (t) => t.palette.mode === 'dark' ? 'radial-gradient(circle at 80% 8%, rgba(124,108,255,.055), transparent 28%), radial-gradient(circle at 18% 82%, rgba(242,124,0,.045), transparent 30%)' : 'radial-gradient(circle at 90% 0%, rgba(242,124,0,.055), transparent 24%), radial-gradient(circle at 0% 100%, rgba(124,108,255,.035), transparent 28%)' }}>
      <AmbientField />
      {!isSuperAdmin && <OnboardingTour
        phase={onboarding.phase}
        steps={onboarding.steps}
        stepIndex={onboarding.stepIndex}
        isRecruiter={onboarding.isRecruiter}
        onBeginTour={onboarding.beginTour}
        onNext={onboarding.next}
        onBack={onboarding.back}
        onSkip={onboarding.skip}
        onSuccessPrimary={goPrimaryCta}
        onSuccessSecondary={goDashboard}
      />}

      {/* Permanent sidebar (desktop) */}
      {!isMobile && <Sidebar variant="permanent" />}

      {/* Temporary drawer (mobile) */}
      {isMobile && (
        <Sidebar variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} />
      )}

      {/* Floating AI HR — intentionally outside the dashboard layout. It stays as a compact launcher in the lower-right corner. */}
      <FloatingAIHRAssistant />

      {/* Main content */}
      <Box component="main" sx={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNav
          onMenuToggle={() => setMobileOpen(o => !o)}
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
        />
        <Box data-app-scroll="true" ref={mainRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehaviorY: 'contain', scrollbarGutter: 'stable', pt: { xs: 3, md: 4.8 }, px: { xs: 2, sm: 4, md: 6.5 }, pb: { xs: 4.5, md: 6.5 } }}>
          <Box className="fade-in page-enter si-page-content" sx={{ width: '100%', maxWidth: 1440, mx: 'auto' }}>
            <Outlet context={{ startTour: onboarding.startTour }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
