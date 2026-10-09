import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import MessageRoundedIcon from '@mui/icons-material/MessageRounded';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import axiosClient, { unwrap } from '../../api/axiosClient';
import { useAuth } from '../../hooks/useAuth';
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans';

const META = { Free: { accent: '#64748B' }, Go: { accent: '#EA7600' }, Pro: { accent: '#8B5CF6' } };

function Metric({ label, used, limit, icon }) {
  const unlimited = limit < 0;
  const safeUsed = used ?? 0;
  const reached = !unlimited && limit > 0 && safeUsed >= limit;
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, (safeUsed / limit) * 100);
  return <Box sx={{ p: 1.35, borderRadius: 2.6, bgcolor: 'background.paper', border: '1px solid', borderColor: reached ? 'error.main' : 'divider' }}><Stack direction="row" spacing={.8} alignItems="center"><Box sx={{ color: 'primary.main', display: 'grid', placeItems: 'center' }}>{icon}</Box><Typography variant="caption" color="text.secondary" fontWeight={800}>{label}</Typography></Stack><Typography sx={{ mt: .5, fontWeight: 950 }}>{safeUsed}{unlimited ? '' : ` / ${limit}`}</Typography>{!unlimited && limit > 0 && <LinearProgress variant="determinate" value={pct} sx={{ mt: .8, height: 5, borderRadius: 99 }} />}</Box>;
}

export default function PlanBillingCard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const recruiter = String(user?.role || '').toUpperCase() === 'RECRUITER';
  const { plans } = useSubscriptionPlans(recruiter ? 'recruiter' : 'candidate');
  const [data, setData] = useState(null); const [usage, setUsage] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.all([axiosClient.get('/subscription/me').then(unwrap), axiosClient.get('/subscription/usage').then(unwrap)])
      .then(([me, currentUsage]) => { if (active) { setData(me); setUsage(currentUsage); } })
      .catch(() => {});
    return () => { active = false; };
  }, [user?.id]);

  const plan = data?.plan || 'Free';
  const meta = META[plan] || META.Free;
  const livePlan = plans.find((x) => x.id === plan) || plans.find((x) => x.id === 'Free');
  const limits = livePlan?.limits || data?.limits || {};
  const caps = livePlan?.capabilities || {};
  const primary = useMemo(() => recruiter ? { label: t('billingPage.activeJobs'), value: usage?.activeJobs, limit: limits.activeJobs, icon: <WorkOutlineRoundedIcon sx={{ fontSize: 18 }} /> } : { label: t('billingPage.interviews'), value: usage?.interviews, limit: limits.monthlyInterviews, icon: <VideocamRoundedIcon sx={{ fontSize: 18 }} /> }, [recruiter, usage, limits, t]);

  return <Box sx={{ mt: 3.2, mb: 3.5, overflow: 'hidden', borderRadius: 4.5, border: '1px solid', borderColor: `${meta.accent}45`, background: (theme) => theme.palette.mode === 'dark' ? `linear-gradient(145deg, ${meta.accent}18, rgba(255,255,255,.025))` : `linear-gradient(145deg, ${meta.accent}0d, #fff)`, boxShadow: `0 20px 60px ${meta.accent}12` }}>
    <Box sx={{ p: { xs: 2.5, md: 3.3 } }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2.2}>
        <Stack direction="row" spacing={1.4} alignItems="center"><Box sx={{ width: 48, height: 48, borderRadius: 2.7, display: 'grid', placeItems: 'center', bgcolor: `${meta.accent}13`, color: meta.accent }}><WorkspacePremiumRoundedIcon /></Box><Box><Stack direction="row" spacing={.9} alignItems="center"><Typography variant="h6" fontWeight={950}>{t('billingPage.manageSubscription')}</Typography><Chip label={plan} size="small" sx={{ color: meta.accent, border: `1px solid ${meta.accent}45`, bgcolor: `${meta.accent}0e`, fontWeight: 900 }} /></Stack><Typography variant="body2" color="text.secondary" sx={{ mt: .35 }}>{livePlan?.description || t('billingPage.liveUsageBody')}</Typography></Box></Stack>
        <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/billing')} sx={{ minWidth: 175, borderRadius: 2.6, fontWeight: 900, bgcolor: meta.accent, '&:hover': { bgcolor: meta.accent, filter: 'brightness(.95)' } }}>{plan === 'Free' ? t('billingPage.viewPlans') : t('billingPage.managePlan')}</Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: recruiter ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }, gap: 1.2, mt: 2.4 }}>
        <Metric {...primary} />
        <Metric label={t('billingPage.aiActions')} value={usage?.aiActions} limit={limits.monthlyAiActions} icon={<SmartToyRoundedIcon sx={{ fontSize: 18 }} />} />
        {recruiter && <Metric label={t('billingPage.assistant')} value={usage?.assistantMessages} limit={limits.monthlyAssistantMessages} icon={<MessageRoundedIcon sx={{ fontSize: 18 }} />} />}
      </Box>
      <Box sx={{ mt: 1.4, p: 1.2, borderRadius: 2.4, bgcolor: 'action.hover' }}><Typography variant="caption" color="text.secondary" fontWeight={800}>{recruiter ? (caps.aiHrAssistant ? t('billingPage.interviewActive') : t('billingPage.assistantLocked')) : t('billingPage.interviewActive')}</Typography></Box>
    </Box>
  </Box>;
}
