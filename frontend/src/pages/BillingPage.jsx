import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Stack, Typography,
} from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axiosClient, { unwrap } from '../api/axiosClient';
import { getErrorMessage } from '../utils/errorUtils';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n';
import { useSubscriptionPlans } from '../hooks/useSubscriptionPlans';

const PLAN_STYLE = {
  Free: { accent: '#64748B', soft: 'rgba(100,116,139,.10)', icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 23 }} /> },
  Go: { accent: '#EA7600', soft: 'rgba(234,118,0,.10)', icon: <AutoAwesomeRoundedIcon sx={{ fontSize: 23 }} /> },
  Pro: { accent: '#8B5CF6', soft: 'rgba(139,92,246,.10)', icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 23 }} /> },
};

const money = (price) => price === 0 ? 'Free' : `$${Number(price).toFixed(2)}`;
const limitText = (limit, singular, plural = `${singular}s`, locale = 'en') => {
  if (limit < 0) return locale === 'az' ? `Limitsiz ${plural}` : locale === 'ru' ? `Безлимитно: ${plural}` : `Unlimited ${plural}`;
  const word = limit === 1 ? singular : plural;
  return `${limit} ${word}`;
};

function LiveUsage({ label, value, icon, remainingText, unlimitedText }) {
  const used = value?.used ?? 0;
  const limit = value?.limit ?? 0;
  const unlimited = limit < 0;
  const percent = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const reached = !unlimited && limit > 0 && used >= limit;
  return (
    <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.7, md: 2 }, borderRadius: 3, border: '1px solid', borderColor: reached ? 'error.main' : 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Box sx={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: 'action.hover' }}>{icon}</Box>
        <Typography variant="caption" color="text.secondary" fontWeight={850}>{label}</Typography>
      </Stack>
      <Typography sx={{ fontSize: '1.35rem', lineHeight: 1, fontWeight: 950, letterSpacing: '-.04em' }}>
        {used}{unlimited ? '' : ` / ${limit}`}
      </Typography>
      <Typography variant="caption" color={reached ? 'error.main' : 'text.secondary'} fontWeight={750}>
        {unlimited ? unlimitedText : remainingText(limit, used)}
      </Typography>
      {!unlimited && limit > 0 && <Box sx={{ mt: 1.2, height: 6, borderRadius: 99, overflow: 'hidden', bgcolor: 'action.hover' }}><Box sx={{ height: '100%', width: `${percent}%`, bgcolor: reached ? 'error.main' : 'primary.main', borderRadius: 99 }} /></Box>}
    </Box>
  );
}

export default function BillingPage({ success = false }) {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isRecruiter = String(user?.role || '').toUpperCase() === 'RECRUITER';
  const { plans, loading: plansLoading } = useSubscriptionPlans(isRecruiter ? 'recruiter' : 'candidate');
  const [current, setCurrent] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelScheduled, setCancelScheduled] = useState(false);

  const load = useCallback(async () => {
    const [me, currentUsage] = await Promise.all([
      axiosClient.get('/subscription/me').then(unwrap),
      axiosClient.get('/subscription/usage').then(unwrap),
    ]);
    setCurrent(me); setUsage(currentUsage);
  }, []);

  const syncCheckout = useCallback(async (sessionId) => {
    setSyncing(true); setError('');
    try { await axiosClient.post('/subscription/sync', { sessionId }).then(unwrap); await load(); setSynced(true); }
    catch (e) { setError(getErrorMessage(e)); }
    finally { setSyncing(false); }
  }, [load]);

  useEffect(() => {
    const sessionId = params.get('session_id');
    if (success && sessionId) syncCheckout(sessionId);
    else load().catch((e) => setError(getErrorMessage(e)));
  }, [success, params, load, syncCheckout]);

  const checkout = async (plan) => {
    setLoading(plan); setError('');
    try {
      const result = await axiosClient.post('/subscription/checkout', { plan }).then(unwrap);
      if (!result?.checkoutUrl) throw new Error('Checkout is not available right now.');
      window.location.assign(result.checkoutUrl);
    } catch (e) { setError(getErrorMessage(e)); setLoading(''); }
  };

  const portal = async () => {
    setError('');
    try { const result = await axiosClient.post('/subscription/portal').then(unwrap); window.location.assign(result.url); }
    catch (e) { setError(getErrorMessage(e)); }
  };

  const cancelSubscription = async () => {
    setCanceling(true); setError('');
    try {
      const result = await axiosClient.post('/subscription/cancel').then(unwrap);
      setCancelScheduled(true); setCancelOpen(false); await load();
      if (result?.renewalDate) setCurrent((prev) => prev ? { ...prev, renewalDate: result.renewalDate } : prev);
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setCanceling(false); }
  };

  const activePlan = current?.plan || 'Free';
  const renewal = current?.renewalDate ? new Date(current.renewalDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
  const primaryUsage = isRecruiter ? usage?.activeJobs : usage?.interviews;
  const aiUsage = usage?.aiActions;

  return (
    <Box className="si-billing-page" sx={{ minHeight: '100%', maxWidth: 1360, mx: 'auto', px: { xs: 2, sm: 3, lg: 5 }, py: { xs: 2.5, md: 5 } }}>
      <Button startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(-1)} sx={{ mb: { xs: 2.5, md: 4 }, borderRadius: 2.5, fontWeight: 850 }}>{t('billingPage.back')}</Button>

      {(syncing || error || (success && synced)) && <Stack spacing={1.5} sx={{ mb: 3 }}>
        {syncing && <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ borderRadius: 3 }}>{t('billingPage.confirming')}</Alert>}
        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
        {success && synced && !error && <Alert severity="success" icon={<CheckCircleRoundedIcon />} sx={{ borderRadius: 3 }}>Your <strong>{activePlan}</strong> plan is active. The new limits are now available.</Alert>}
      </Stack>}

      <Box sx={{ mb: 5.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
          <WorkspacePremiumRoundedIcon sx={{ color: '#EA7600' }} />
          <Typography variant="overline" sx={{ color: '#EA7600', fontWeight: 950, letterSpacing: '.14em' }}>{isRecruiter ? t('billingPage.kickerRecruiter') : t('billingPage.kickerCandidate')}</Typography>
        </Stack>
        <Typography variant="h2" fontWeight={950} sx={{ fontSize: { xs: '2.5rem', md: '4.1rem' }, lineHeight: .98, letterSpacing: '-.065em', maxWidth: 940 }}>
          {isRecruiter ? t('billingPage.heroRecruiter') : t('billingPage.heroCandidate')}
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1.8, maxWidth: 760, fontSize: { md: '1.05rem' }, lineHeight: 1.8 }}>
          {t('billingPage.heroBody')}
        </Typography>
      </Box>

      {plansLoading && !plans.length ? <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress /></Box> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: { xs: 2.5, lg: 3.2 }, alignItems: 'stretch' }}>
          {plans.map((plan) => {
            const style = PLAN_STYLE[plan.id] || PLAN_STYLE.Free;
            const currentPlan = activePlan === plan.id;
            const isPaidSwitch = activePlan !== 'Free' && !currentPlan && plan.id !== 'Free';
            const limits = plan.limits || {};
            const caps = plan.capabilities || {};
            return (
              <Box key={plan.id} sx={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: { lg: 590 }, p: { xs: 2.7, md: 3.3 }, borderRadius: 5, border: '1px solid', borderColor: currentPlan ? style.accent : 'divider', bgcolor: 'background.paper', boxShadow: plan.id === 'Go' ? `0 30px 85px ${style.accent}18` : '0 14px 42px rgba(0,0,0,.045)', transform: { lg: plan.id === 'Go' ? 'translateY(-10px)' : 'none' } }}>
                {plan.id === 'Go' && <Box sx={{ position: 'absolute', top: -12, left: 24, px: 1.5, py: .65, borderRadius: 99, color: '#fff', bgcolor: style.accent, fontSize: '.66rem', fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase', boxShadow: `0 10px 26px ${style.accent}44` }}>{t('billingPage.mostBalanced')}</Box>}
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}>
                  <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: style.accent, bgcolor: style.soft, fontWeight: 950 }}>{style.icon}</Box>
                    <Box><Typography variant="h5" fontWeight={950}>{plan.name}</Typography><Typography variant="caption" color="text.secondary">{plan.description}</Typography></Box>
                  </Stack>
                  {currentPlan && <Chip icon={<CheckCircleRoundedIcon sx={{ fontSize: '15px !important' }} />} label={t('billingPage.current')} size="small" sx={{ color: style.accent, bgcolor: style.soft, fontWeight: 900 }} />}
                </Stack>

                <Box sx={{ mt: 3 }}><Typography sx={{ fontSize: '2.5rem', fontWeight: 950, letterSpacing: '-.065em' }}>{money(plan.price)}</Typography>{plan.price > 0 && <Typography component="span" color="text.secondary" sx={{ ml: .6, fontSize: '.78rem', fontWeight: 750 }}>{t('billingPage.perMonth')}</Typography>}</Box>

                <Divider sx={{ my: 2.8 }} />
                <Box sx={{ mb: 1.8, px: 1.25, py: .95, borderRadius: 2.4, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}><Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>{t('billingPage.aiAllowanceNote')}</Typography></Box>
                <Stack spacing={1.05} sx={{ flex: 1 }}>
                  {(plan.features || []).map((feature, i) => <Stack key={`${feature}-${i}`} direction="row" spacing={1.1} alignItems="flex-start"><CheckCircleRoundedIcon sx={{ color: style.accent, fontSize: 19, mt: .12, flexShrink: 0 }} /><Typography variant="body2" sx={{ lineHeight: 1.55 }}>{feature}</Typography></Stack>)}
                </Stack>

                <Box sx={{ mt: 3, p: 1.9, borderRadius: 3.5, bgcolor: style.soft, border: '1px solid', borderColor: `${style.accent}28` }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={900}>{t('billingPage.activeFeaturesTitle')}</Typography>
                  <Stack spacing={.85} sx={{ mt: 1.1 }}>
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={800}>{isRecruiter ? t('billingPage.activeJobs') : t('billingPage.interviews')}</Typography><Typography variant="body2" fontWeight={950}>{limitText(isRecruiter ? (limits.activeJobs ?? 0) : (limits.monthlyInterviews ?? 0), isRecruiter ? (language === 'az' ? 'vakansiya' : language === 'ru' ? 'вакансия' : 'job') : (language === 'az' ? 'müsahibə' : language === 'ru' ? 'собеседование' : 'interview'), isRecruiter ? (language === 'az' ? 'vakansiya' : language === 'ru' ? 'вакансий' : 'jobs') : (language === 'az' ? 'müsahibə' : language === 'ru' ? 'собеседований' : 'interviews'), language)}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={800}>{t('billingPage.aiInterviewReports')}</Typography><Chip size="small" label={caps.aiInterview ? t('billingPage.active') : t('billingPage.locked')} icon={caps.aiInterview ? <CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 26, fontWeight: 900, color: caps.aiInterview ? style.accent : 'text.secondary', bgcolor: caps.aiInterview ? `${style.accent}12` : 'action.hover' }} /></Stack>
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={800}>{t('billingPage.aiActions')}</Typography><Typography variant="body2" fontWeight={950}>{limitText(limits.monthlyAiActions ?? 0, language === 'az' ? 'əməliyyat' : language === 'ru' ? 'операция' : 'action', language === 'az' ? 'əməliyyat' : language === 'ru' ? 'операций' : 'actions', language)}</Typography></Stack>
                    {isRecruiter && <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={800}>{t('billingPage.assistant')}</Typography><Chip size="small" label={caps.aiHrAssistant ? limitText(limits.monthlyAssistantMessages ?? 0, language === 'az' ? 'mesaj' : language === 'ru' ? 'сообщение' : 'message', language === 'az' ? 'mesaj' : language === 'ru' ? 'сообщений' : 'messages', language) : t('billingPage.locked')} icon={caps.aiHrAssistant ? <CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 26, fontWeight: 900, color: caps.aiHrAssistant ? style.accent : 'text.secondary', bgcolor: caps.aiHrAssistant ? `${style.accent}12` : 'action.hover' }} /></Stack>}
                    <Stack direction="row" justifyContent="space-between" gap={1}><Typography variant="body2" fontWeight={800}>{t('billingPage.advancedAnalytics')}</Typography><Chip size="small" label={caps.advancedAnalytics ? t('billingPage.includedLabel') : t('billingPage.coreOnly')} icon={caps.advancedAnalytics ? <CheckCircleRoundedIcon sx={{ fontSize: '14px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '14px !important' }} />} sx={{ height: 26, fontWeight: 900, color: caps.advancedAnalytics ? style.accent : 'text.secondary', bgcolor: caps.advancedAnalytics ? `${style.accent}12` : 'action.hover' }} /></Stack>
                  </Stack>
                </Box>

                <Button fullWidth size="large" variant={currentPlan ? 'outlined' : plan.id === 'Go' ? 'contained' : 'outlined'} disabled={loading === plan.id || currentPlan || plan.id === 'Free' || isPaidSwitch} onClick={() => checkout(plan.id)} sx={{ mt: 2, minHeight: 50, borderRadius: 2.8, fontWeight: 950, ...(plan.id === 'Go' && !currentPlan ? { bgcolor: style.accent, '&:hover': { bgcolor: style.accent, filter: 'brightness(.95)' } } : {}) }}>
                  {loading === plan.id ? <CircularProgress size={20} color="inherit" /> : currentPlan ? t('billingPage.current') : isPaidSwitch ? t('billingPage.managePlan') : plan.id === 'Free' ? t('billingPage.included') : `${t('billingPage.checkout')} ${plan.name}`}
                </Button>
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ mt: 4.5, p: { xs: 2.4, md: 3.2 }, borderRadius: 4.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.5} justifyContent="space-between">
          <Box sx={{ maxWidth: 440 }}>
            <Stack direction="row" spacing={1} alignItems="center"><AutorenewRoundedIcon sx={{ color: PLAN_STYLE[activePlan]?.accent || '#EA7600' }} /><Typography fontWeight={950}>{t('billingPage.liveUsage')}</Typography></Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: .65, lineHeight: 1.7 }}>{t('billingPage.liveUsageBody')}</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ flex: 1, maxWidth: 760 }}>
            <LiveUsage label={isRecruiter ? t('billingPage.activeJobs') : t('billingPage.interviews')} value={primaryUsage} icon={<WorkspacePremiumRoundedIcon sx={{ fontSize: 17 }} />} remainingText={(limit, used) => `${Math.max(0, limit - used)} ${isRecruiter ? t('billingPage.remainingNow') : t('billingPage.remaining')}`} unlimitedText={isRecruiter ? t('billingPage.noLimit') : t('billingPage.noMonthlyCap')} />
            <LiveUsage label={t('billingPage.aiActions')} value={aiUsage} icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 17 }} />} remainingText={(limit, used) => `${Math.max(0, limit - used)} ${t('billingPage.remaining')}`} unlimitedText={t('billingPage.noMonthlyCap')} />
            {isRecruiter && <LiveUsage label={t('billingPage.assistant')} value={usage?.assistantMessages} icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 17 }} />} remainingText={(limit, used) => `${Math.max(0, limit - used)} ${t('billingPage.remaining')}`} unlimitedText={t('billingPage.noMonthlyCap')} />}
          </Stack>
        </Stack>
      </Box>

      {activePlan !== 'Free' && <Box sx={{ mt: 2.2, p: { xs: 2.4, md: 3.2 }, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2.2} alignItems={{ lg: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.3} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: 2.3, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}><ReceiptLongRoundedIcon /></Box><Box><Typography fontWeight={900}>{t('billingPage.manageSubscription')}</Typography><Typography variant="body2" color="text.secondary">{renewal ? `${t('billingPage.nextBillingLabel')}: ${renewal}. ` : ''}{t('billingPage.secureStripe')}</Typography></Box></Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="outlined" onClick={portal} startIcon={<SecurityRoundedIcon />} sx={{ borderRadius: 2.5, fontWeight: 850 }}>{t('billingPage.manageBilling')}</Button>
            <Button color="error" variant="text" onClick={() => setCancelOpen(true)} disabled={cancelScheduled} sx={{ borderRadius: 2.5, fontWeight: 850 }}>{cancelScheduled ? t('billingPage.cancellationScheduled') : t('billingPage.cancel')}</Button>
          </Stack>
        </Stack>
      </Box>}

      <Dialog open={cancelOpen} onClose={() => !canceling && setCancelOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4.5 } }}>
        <DialogTitle sx={{ fontWeight: 950 }}>{t('billingPage.confirmTitle')}</DialogTitle>
        <DialogContent><Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>{t('billingPage.confirmBody', { plan: activePlan, renewal: renewal || (language === 'az' ? 'cari dövrün sonu' : language === 'ru' ? 'конец текущего периода' : 'the end of the current billing period') })}</Typography></DialogContent>
        <DialogActions sx={{ p: 2.5 }}><Button onClick={() => setCancelOpen(false)} disabled={canceling} sx={{ fontWeight: 800 }}>{t('billingPage.keep')}</Button><Button color="error" variant="contained" onClick={cancelSubscription} disabled={canceling} sx={{ borderRadius: 2.5, fontWeight: 900 }}>{canceling ? <CircularProgress size={18} color="inherit" /> : t('billingPage.confirm')}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
