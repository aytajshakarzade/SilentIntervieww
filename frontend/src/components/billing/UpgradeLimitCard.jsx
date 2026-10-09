import { useMemo } from 'react';
import { Box, Button, Chip, Divider, Stack, Typography } from '@mui/material';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useNavigate } from 'react-router-dom';
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans';
import { useAuth } from '../../hooks/useAuth';

export default function UpgradeLimitCard({ plan, title = 'Monthly limit reached', resource = 'interviews' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const recruiter = String(user?.role || '').toUpperCase() === 'RECRUITER';
  const effectivePlan = plan || user?.plan || 'Free';
  const { plans } = useSubscriptionPlans(recruiter ? 'recruiter' : 'candidate');
  const current = plans.find((p) => p.id === effectivePlan) || plans.find((p) => p.id === 'Free');
  const next = plans.find((p) => p.id === 'Go') || plans.find((p) => p.id === 'Pro');
  const limit = resource === 'jobs' ? current?.limits?.activeJobs : resource === 'ai' ? current?.limits?.monthlyAiActions : current?.limits?.monthlyInterviews;
  const label = resource === 'jobs' ? 'active jobs' : resource === 'ai' ? 'AI interview/report actions' : 'interviews';
  const limitText = limit < 0 ? 'Unlimited' : `${limit ?? 0} / month`;
  const nextText = resource === 'jobs' ? `${next?.limits?.activeJobs < 0 ? 'Unlimited' : next?.limits?.activeJobs} active jobs` : resource === 'ai' ? `${next?.limits?.monthlyAiActions < 0 ? 'Unlimited' : next?.limits?.monthlyAiActions} AI interview/report actions` : `${next?.limits?.monthlyInterviews < 0 ? 'Unlimited' : next?.limits?.monthlyInterviews} interviews`;
  const description = useMemo(() => effectivePlan === 'Free' ? `Your Free plan includes ${limitText} ${label}.` : `Your ${effectivePlan} plan has reached its ${label} allowance.`, [label, limitText, effectivePlan]);
  return <Box sx={{ maxWidth: 760, mx: 'auto', p: { xs: 3, sm: 5 }, borderRadius: 5.5, border: '1px solid', borderColor: 'rgba(234,118,0,.25)', background: (theme) => theme.palette.mode === 'dark' ? 'linear-gradient(145deg, rgba(234,118,0,.14), rgba(255,255,255,.02))' : 'linear-gradient(145deg, rgba(234,118,0,.07), #fff)', boxShadow: '0 30px 90px rgba(0,0,0,.11)', textAlign: 'center' }}>
    <Box sx={{ width: 68, height: 68, mx: 'auto', borderRadius: 3.2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.11)', color: '#EA7600', mb: 2.4 }}><LockRoundedIcon sx={{ fontSize: 31 }} /></Box>
    <Chip label={`${effectivePlan} plan`} size="small" sx={{ fontWeight: 900, mb: 1.4, color: '#EA7600', bgcolor: 'rgba(234,118,0,.10)' }} />
    <Typography variant="h4" fontWeight={950} sx={{ letterSpacing: '-.04em' }}>{title}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1.2, maxWidth: 570, mx: 'auto', lineHeight: 1.75 }}>{description} Upgrade when you are ready to continue without interruption.</Typography>
    <Divider sx={{ my: 3 }} />
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: .8, px: 1.3, py: .8, borderRadius: 99, bgcolor: 'action.hover' }}><AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} /><Typography variant="caption" fontWeight={850}>Go unlocks {nextText}</Typography></Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="center" sx={{ mt: 2.6 }}>
      <Button variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/billing')} sx={{ minWidth: 200, bgcolor: '#EA7600', borderRadius: 2.7, py: 1.25, fontWeight: 900, '&:hover': { bgcolor: '#d76800' } }}>View plans</Button>
      <Button variant="outlined" size="large" onClick={() => navigate(recruiter ? '/recruiter/dashboard' : '/candidate/interviews')} sx={{ minWidth: 160, borderRadius: 2.7, py: 1.25, fontWeight: 850 }}>Back</Button>
    </Stack>
  </Box>;
}
