import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Paper, Typography, Button, IconButton, Fade, Grow, useTheme, Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { getEstimatedMinutes } from '../../constants/onboarding';
import { useTranslation } from '../../i18n';

const PADDING = 10;
const CARD_W = 380;
const VIEWPORT_MARGIN = 20;
const CARD_MAX_H_VH = 58;
// How long we're willing to keep polling for a step's target element to
// appear before giving up and falling back to a centered (unanchored)
// card. Covers targets that render after an async fetch resolves (e.g.
// the pipeline board, or a list's first row) rather than being present
// on first paint.
const TARGET_WAIT_TIMEOUT_MS = 1800;
const TARGET_POLL_INTERVAL_MS = 120;

function getTargetRect(targetId) {
  if (!targetId) return null;
  const el = document.querySelector(`[data-tour="${targetId}"]`);
  if (!el) return null;
  el.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'auto' });
  const r = el.getBoundingClientRect();
  return {
    top: r.top, left: r.left, width: r.width, height: r.height,
  };
}

/**
 * Waits (polling on rAF-ish intervals) until `[data-tour="targetId"]`
 * exists in the DOM, then resolves with its rect. If the element already
 * exists it resolves on the next tick. If it never appears within
 * TARGET_WAIT_TIMEOUT_MS, resolves with `null` so the tour can still show
 * an unanchored/centered card rather than getting stuck — a step is never
 * silently skipped, it just degrades gracefully.
 */
function waitForTargetRect(targetId, { onCancelRef } = {}) {
  return new Promise((resolve) => {
    if (!targetId) { resolve(null); return; }

    const start = Date.now();
    let settled = false;

    const attempt = () => {
      if (onCancelRef && onCancelRef.current) { settled = true; resolve(null); return; }
      const rect = getTargetRect(targetId);
      if (rect) { settled = true; resolve(rect); return; }
      if (Date.now() - start >= TARGET_WAIT_TIMEOUT_MS) { settled = true; resolve(null); return; }
      timeoutId = setTimeout(attempt, TARGET_POLL_INTERVAL_MS);
    };

    let timeoutId = setTimeout(attempt, 0);

    // Best-effort early exit via MutationObserver so we pick up the
    // element the instant it mounts, rather than waiting for the next
    // poll tick — the interval above is just the safety net.
    const observer = new MutationObserver(() => {
      if (settled) return;
      const rect = getTargetRect(targetId);
      if (rect) {
        settled = true;
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(rect);
      }
    });
    try {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    } catch {
      /* ignore — MutationObserver unavailable; polling still covers us */
    }

    // Ensure we always clean up the observer once settled via the poll path.
    const originalResolve = resolve;
    resolve = (value) => { // eslint-disable-line no-func-assign
      observer.disconnect();
      originalResolve(value);
    };
  });
}

function computeCardPosition(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxCardH = Math.min(vh - VIEWPORT_MARGIN * 2, Math.floor(vh * (CARD_MAX_H_VH / 100)));

  // A centred card is the safest fallback when an anchored placement would
  // leave too little vertical space. This is especially important for large
  // targets such as the pipeline board: the explanation must remain fully
  // readable instead of being pushed below the viewport.
  if (!rect || placement === 'center') {
    return { top: vh / 2, left: vw / 2, transform: 'translate(-50%, -50%)' };
  }

  const spaceRight = vw - (rect.left + rect.width);
  const spaceBelow = vh - (rect.top + rect.height);
  const spaceAbove = rect.top;
  const canFitRight = spaceRight >= CARD_W + VIEWPORT_MARGIN;
  const canFitBelow = spaceBelow >= Math.min(300, maxCardH) + PADDING;
  const canFitAbove = spaceAbove >= Math.min(300, maxCardH) + PADDING;

  if (placement === 'right' && canFitRight) {
    return { top: rect.top, left: rect.left + rect.width + PADDING + 12, transform: 'none' };
  }

  if (placement === 'top' && canFitAbove) {
    return { top: rect.top - PADDING - 12, left: rect.left, transform: 'translateY(-100%)' };
  }

  if (placement === 'bottom' && canFitBelow) {
    return { top: rect.top + rect.height + PADDING + 12, left: rect.left, transform: 'none' };
  }

  if (canFitBelow) {
    return { top: rect.top + rect.height + PADDING + 12, left: rect.left, transform: 'none' };
  }

  if (canFitAbove) {
    return { top: rect.top - PADDING - 12, left: rect.left, transform: 'translateY(-100%)' };
  }

  // Neither side has enough room: let the clamp logic place a compact,
  // readable card inside the viewport rather than allowing it to disappear.
  return { top: vh / 2, left: vw / 2, transform: 'translate(-50%, -50%)' };
}

/** Clamp a Paper element fully inside the viewport, after it has its real size. */
function useClampedPosition(rawPos, ready, deps) {
  const ref = useRef(null);
  const [pos, setPos] = useState(rawPos);

  useLayoutEffect(() => {
    if (!ready) return;
    // Let the browser paint the card at its natural size first.
    const raf = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) { setPos(rawPos); return; }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      if (rawPos.transform && rawPos.transform.includes('translate(-50%, -50%)')) {
        setPos(rawPos);
        return;
      }

      // Resolve the anchor point the transform implies, in real pixels.
      let top = rawPos.top;
      let left = rawPos.left;
      if (rawPos.transform === 'translateY(-100%)') top -= h;

      top = Math.min(Math.max(top, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vh - h - VIEWPORT_MARGIN));
      left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(VIEWPORT_MARGIN, vw - w - VIEWPORT_MARGIN));

      setPos({ top, left, transform: 'none' });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ...deps]);

  return [ref, pos];
}

/** Centered branded modal shell shared by the welcome & success screens. */
function CenterModal({ open, onClose, children, ariaLabel }) {
  if (!open) return null;
  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      sx={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}
    >
      <Fade in={open} timeout={280}>
        <Box
          onClick={onClose}
          sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 20%, rgba(91,94,232,0.32), rgba(10,10,13,0.75) 65%)', backdropFilter: 'blur(3px)' }}
        />
      </Fade>
      <Grow in={open} timeout={320}>
        <Paper
          elevation={12}
          sx={{
            position: 'relative', width: 460, maxWidth: '100%', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto',
            borderRadius: 4, p: { xs: 3, sm: 4.5 }, textAlign: 'center',
          }}
        >
          {children}
        </Paper>
      </Grow>
    </Box>,
    document.body,
  );
}

function WelcomeScreen({ open, stepCount, isRecruiter, onStart, onSkip }) {
  const { t } = useTranslation();
  const minutes = getEstimatedMinutes(stepCount);
  return (
    <CenterModal open={open} onClose={onSkip} ariaLabel={t('onboardingTour.welcomeTourAria')}>
      <Box sx={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,94,232,0.32) 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <Avatar
        sx={{
          width: 56, height: 56, mx: 'auto', mb: 2.5,
          background: 'linear-gradient(135deg, #F28C28, #B96313)',
          boxShadow: '0 8px 24px rgba(91,94,232,0.35)',
        }}
      >
        <AutoAwesomeIcon />
      </Avatar>

      <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Plus Jakarta Sans", sans-serif', mb: 1 }}>
        {t('onboardingTour.welcomeTitle')}
      </Typography>

      <Typography color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: 3, lineHeight: 1.6 }}>
        {isRecruiter
          ? t('onboardingTour.welcomeBodyRecruiter')
          : t('onboardingTour.welcomeBodyCandidate')}
      </Typography>

      <Box sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 2, py: 0.75, borderRadius: 5,
        bgcolor: 'action.hover', mb: 3.5,
      }}>
        <ScheduleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {t('onboardingTour.aboutMinutes', { minutes, plural: minutes === 1 ? '' : 's', steps: stepCount })}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
        <Button variant="text" color="inherit" onClick={onSkip}>
          {t('onboardingTour.skipForNow')}
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          endIcon={<ArrowForwardIcon />}
          sx={{ px: 3 }}
        >
          {t('onboardingTour.startTour')}
        </Button>
      </Box>
    </CenterModal>
  );
}

function SuccessScreen({ open, isRecruiter, onPrimary, onSecondary }) {
  const { t } = useTranslation();
  return (
    <CenterModal open={open} onClose={onSecondary} ariaLabel={t('onboardingTour.tourCompleteAria')}>
      <Box sx={{
        position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)', pointerEvents: 'none',
      }} />

      <Avatar
        sx={{
          width: 56, height: 56, mx: 'auto', mb: 2.5,
          background: 'linear-gradient(135deg, #28C76F, #F28C28)',
          boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
        }}
      >
        <CheckCircleIcon />
      </Avatar>

      <Typography variant="h5" fontWeight={800} sx={{ fontFamily: '"Plus Jakarta Sans", sans-serif', mb: 1 }}>
        {t('onboardingTour.readyTitle')}
      </Typography>

      <Typography color="text.secondary" sx={{ maxWidth: 380, mx: 'auto', mb: 3.5, lineHeight: 1.6 }}>
        {isRecruiter
          ? t('onboardingTour.readyBodyRecruiter')
          : t('onboardingTour.readyBodyCandidate')}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={onSecondary}>
          {t('onboardingTour.goToDashboard')}
        </Button>
        <Button variant="contained" onClick={onPrimary} endIcon={<ArrowForwardIcon />} sx={{ px: 3 }}>
          {isRecruiter ? t('onboardingTour.createFirstJob') : t('onboardingTour.browseInterviews')}
        </Button>
      </Box>
    </CenterModal>
  );
}

function TourSpotlight({ open, steps, stepIndex, onNext, onBack, onSkip }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cancelRef = useRef(false);

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  const recompute = useCallback(() => {
    if (!step) return;
    if (!step.target) {
      setRect(null);
      setReady(true);
      return;
    }
    waitForTargetRect(step.target, { onCancelRef: cancelRef }).then((r) => {
      if (cancelRef.current) return;
      setRect(r);
      setReady(true);
    });
  }, [step]);

  // If this step lives on a different page, navigate there first, then
  // wait (with polling, not a fixed guess) for the target element to
  // actually exist before measuring — covers targets that only render
  // after that page's own data fetch resolves.
  useEffect(() => {
    if (!open || !step) return undefined;
    cancelRef.current = false;
    setReady(false);
    setRect(null);

    const needsNav = step.route && location.pathname !== step.route;
    if (needsNav) navigate(step.route);

    // Small delay so a just-triggered navigation has a chance to start
    // unmounting the old page before we begin polling for the new target —
    // otherwise we could momentarily match a stale element with the same
    // data-tour id left over from the previous page during the transition.
    const t = setTimeout(recompute, needsNav ? 60 : 0);
    return () => { cancelRef.current = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  useEffect(() => {
    if (!open) { cancelRef.current = true; }
    return undefined;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = () => {
      if (!step?.target) return;
      const r = getTargetRect(step.target);
      if (r) setRect(r);
    };
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onSkip();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') onNext();
      else if (e.key === 'ArrowLeft') onBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onNext, onBack, onSkip]);

  const rawPos = step ? (step.focus ? { top: window.innerHeight / 2, left: window.innerWidth / 2, transform: 'translate(-50%, -50%)' } : computeCardPosition(rect, step.placement)) : { top: 0, left: 0, transform: 'none' };
  const [cardRef, pos] = useClampedPosition(rawPos, ready, [rect?.top, rect?.left, rect?.width, rect?.height, step?.placement]);

  useEffect(() => {
    if (ready && cardRef.current) cardRef.current.focus({ preventScroll: true });
  }, [ready, stepIndex, cardRef]);

  if (!open || !step) return null;

  return createPortal(
    <Box role="dialog" aria-modal="true" aria-label={t('onboardingTour.productTourAria')} sx={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'auto' }}>
      <Box onClick={onSkip} sx={{ position: 'absolute', inset: 0, background: rect ? 'transparent' : 'rgba(15,15,25,0.55)', transition: 'background 200ms ease' }} />
      {rect ? (
        <>
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(rect.top - PADDING, 0), bgcolor: 'rgba(15,15,25,0.62)', transition: 'all 220ms ease' }} />
          <Box sx={{ position: 'absolute', top: rect.top - PADDING, left: 0, width: Math.max(rect.left - PADDING, 0), height: rect.height + PADDING * 2, bgcolor: 'rgba(15,15,25,0.62)', transition: 'all 220ms ease' }} />
          <Box sx={{ position: 'absolute', top: rect.top - PADDING, left: rect.left + rect.width + PADDING, right: 0, height: rect.height + PADDING * 2, bgcolor: 'rgba(15,15,25,0.62)', transition: 'all 220ms ease' }} />
          <Box sx={{ position: 'absolute', top: rect.top + rect.height + PADDING, left: 0, right: 0, bottom: 0, bgcolor: 'rgba(15,15,25,0.62)', transition: 'all 220ms ease' }} />
          <Box
            sx={{
              position: 'absolute', top: rect.top - PADDING, left: rect.left - PADDING,
              width: rect.width + PADDING * 2, height: rect.height + PADDING * 2, borderRadius: 2.5,
              boxShadow: `0 0 0 3px ${theme.palette.primary.main}, 0 0 24px 4px rgba(91,94,232,0.35)`,
              pointerEvents: 'none', transition: 'all 220ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </>
      ) : null}

      <Grow in={ready} timeout={260}>
        <Paper
          ref={cardRef}
          tabIndex={-1}
          elevation={10}
          sx={{
            position: 'absolute', top: pos.top, left: pos.left, transform: pos.transform,
            width: { xs: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`, sm: 500 }, maxWidth: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)`,
            maxHeight: `min(calc(100vh - ${VIEWPORT_MARGIN * 2}px), 68vh)`, overflow: 'hidden', overscrollBehavior: 'contain',
            borderRadius: 3.5, p: { xs: 1.8, sm: 2.35 }, outline: 'none', display: 'flex', flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="overline" color="primary.main" fontWeight={700} sx={{ letterSpacing: 0.6 }}>
              {t('onboardingTour.stepOf', { current: stepIndex + 1, total: steps.length })}
            </Typography>
            <IconButton size="small" onClick={onSkip} aria-label={t('onboardingTour.closeTourAria')} sx={{ mt: -0.75, mr: -0.75 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: .5, mr: -.5, '&::-webkit-scrollbar': { width: 5 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'action.disabledBackground', borderRadius: 5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 1.15 }}>
              <Box sx={{ width: 34, height: 34, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.10)', color: 'primary.main', flexShrink: 0 }}>
                <AutoAwesomeIcon sx={{ fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={900} sx={{ minWidth: 0 }}>{step.title}</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, lineHeight: 1.6 }}>
              {step.what}
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5, p: 1.05, borderRadius: 2.2, bgcolor: 'rgba(234,118,0,.055)', border: '1px solid rgba(234,118,0,.12)' }}>
              <ArrowRightAltIcon sx={{ fontSize: 18, color: 'primary.main', flexShrink: 0 }} />
              <Typography variant="caption" fontWeight={800} sx={{ lineHeight: 1.5 }}>{step.next}</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexShrink: 0, pt: 1.4, mt: 1, backgroundColor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
            {!isFirst && (
              <Button size="small" onClick={onBack} startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}>
                {t('onboardingTour.back')}
              </Button>
            )}
            {!isLast && (
              <Button size="small" color="inherit" onClick={onSkip}>
                {t('onboardingTour.skip')}
              </Button>
            )}
            <Button size="small" variant="contained" onClick={onNext} endIcon={!isLast ? <ArrowForwardIcon sx={{ fontSize: 16 }} /> : null}>
              {isLast ? t('onboardingTour.finish') : t('onboardingTour.next')}
            </Button>
          </Box>

          <Box sx={{ mt: 1.5, height: 5, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${((stepIndex + 1) / steps.length) * 100}%`, bgcolor: 'primary.main', borderRadius: 2, transition: 'width 280ms ease' }} />
          </Box>
        </Paper>
      </Grow>
    </Box>,
    document.body,
  );
}

/**
 * Top-level onboarding experience: welcome screen -> spotlight tour -> success screen.
 * `phase` comes from useOnboarding: 'welcome' | 'touring' | 'success' | 'closed'.
 */
export default function OnboardingTour({
  phase, steps, stepIndex, isRecruiter,
  onBeginTour, onNext, onBack, onSkip, onSuccessPrimary, onSuccessSecondary,
}) {
  return (
    <>
      <WelcomeScreen
        open={phase === 'welcome'}
        stepCount={steps.length}
        isRecruiter={isRecruiter}
        onStart={onBeginTour}
        onSkip={onSkip}
      />
      <TourSpotlight
        open={phase === 'touring'}
        steps={steps}
        stepIndex={stepIndex}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
      />
      <SuccessScreen
        open={phase === 'success'}
        isRecruiter={isRecruiter}
        onPrimary={onSuccessPrimary}
        onSecondary={onSuccessSecondary}
      />
    </>
  );
}
