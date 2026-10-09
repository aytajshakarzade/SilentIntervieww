import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, Grid, Skeleton, Stack, Typography, Avatar } from '@mui/material';
import WorkIcon from '@mui/icons-material/Work';
import PeopleIcon from '@mui/icons-material/People';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ActivityTimeline from '../../components/ui/ActivityTimeline';
import { analyticsApi } from '../../api/analyticsApi';
import { activityApi } from '../../api/activityApi';
import { notificationApi } from '../../api/notificationApi';
import { interviewService } from '../../services/interviewService';
import { companyService } from '../../services/companyService';
import { unwrapPaged } from '../../utils/unwrapPaged';
import { fmtTimeAgo } from '../../utils/formatters';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';
import { PremiumCard, PremiumButton, PremiumMetricCard, PremiumChartCard } from '../../components/design';

const COLORS = [tokens.indigo[600], tokens.violet[600], '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e'];
const items = (value) => Array.isArray(value) ? value : (value?.items ?? []);
const percentage = (value, total) => total ? Math.max(0, Math.min(100, Math.round((value || 0) * 100 / total))) : null;
const localizeStatus = (status, language) => {
  const key = String(status || '').toLowerCase().replace(/[^a-z]/g, '');
  const maps = {
    az: { applied: 'Müraciət edildi', reviewpending: 'Nəzərdən keçirilir', interviewed: 'Müsahibə keçirildi', shortlisted: 'Qısa siyahıda', accepted: 'Qəbul edildi', hired: 'İşə qəbul edildi', rejected: 'Rədd edildi', offersent: 'Təklif göndərildi', archived: 'Arxivləndi' },
    en: { applied: 'Applied', reviewpending: 'Review pending', interviewed: 'Interviewed', shortlisted: 'Shortlisted', accepted: 'Accepted', hired: 'Hired', rejected: 'Rejected', offersent: 'Offer sent', archived: 'Archived' },
    ru: { applied: 'Отклик', reviewpending: 'На рассмотрении', interviewed: 'Интервью пройдено', shortlisted: 'В шорт-листе', accepted: 'Принят', hired: 'Нанят', rejected: 'Отклонён', offersent: 'Оффер отправлен', archived: 'Архив' },
  };
  return maps[language]?.[key] || status || '—';
};

function DashboardSkeleton() {
  return <Grid container spacing={3.5}>{Array.from({ length: 8 }).map((_, index) => <Grid item xs={12} md={index < 4 ? 3 : 6} key={index}><Skeleton variant="rounded" height={index < 4 ? 150 : 280} /></Grid>)}</Grid>;
}

export default function RecruiterDashboard() {
  const { t, language } = useTranslation();
  const [data, setData] = useState({ overview: null, activities: [], notifications: [], sessions: [], reports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Use allSettled so a single failing endpoint does not blank the whole dashboard.
      const [overviewResult, activitiesResult, notificationsResult, sessionsResult, reportsResult, companyResult] =
        await Promise.allSettled([
          analyticsApi.getCoreOverview('monthly'),
          activityApi.getRecent(10),
          notificationApi.getMine(6),
          interviewService.sessions.getAll({ pageSize: 100 }),
          interviewService.reports.getAll({ pageSize: 100 }),
          companyService.getAll({ pageNumber: 1, pageSize: 1 }),
        ]);

      const val = (result, fallback) => result.status === 'fulfilled' ? result.value : fallback;

      // A dashboard should never disappear because an optional panel is
      // unavailable. Only a genuine dashboard-wide data failure is surfaced.
      const firstError = [overviewResult, activitiesResult, notificationsResult, sessionsResult, reportsResult, companyResult]
        .find((r) => r.status === 'rejected');
      if (firstError && overviewResult.status === 'rejected') {
        setError(firstError.reason?.message || t('recruiterDashboard.loadError'));
      }

      setData({
        overview:      val(overviewResult, null),
        activities:    items(val(activitiesResult, [])),
        notifications: val(notificationsResult, { items: [] })?.items ?? [],
        sessions:      items(val(sessionsResult, [])),
        reports:       items(val(reportsResult, [])),
        company:       unwrapPaged(val(companyResult, []))[0] ?? null,
      });
    } catch (requestError) {
      setError(requestError?.message || t('recruiterDashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const overview = data.overview || {};
    const completedSessions = data.sessions.filter((session) => session.endedAt && session.startedAt);
    const averageMinutes = completedSessions.length
      ? Math.round(completedSessions.reduce((sum, session) => sum + Math.max(0, new Date(session.endedAt) - new Date(session.startedAt)), 0) / completedSessions.length / 60000)
      : null;
    return {
      completionRate: percentage(overview.completedInterviews, overview.totalApplications),
      acceptanceRate: percentage(overview.acceptedApplications, overview.totalApplications),
      averageMinutes,
      averageScore: overview.averageInterviewScore,
    };
  }, [data]);

  const overview = data.overview || {};
  const scoreBySession = new Map(data.reports.map((report) => [report.interviewSessionId, report.score]));
  const recentSessions = [...data.sessions].sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 5).map((session) => ({ ...session, score: scoreBySession.get(session.id) }));

  if (loading) return <DashboardSkeleton />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ letterSpacing: '-0.02em' }}>{t('recruiterDashboard.title')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{t('recruiterDashboard.subtitle')}</Typography>
        </Box>
        <PremiumButton variant="outlined" startIcon={<RefreshIcon />} onClick={load}>{t('recruiterDashboard.refresh')}</PremiumButton>
      </Box>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{t('recruiterDashboard.retry')}</Button>} sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.6fr .9fr' }, gap: 2.2, mb: 3 }}>
        <PremiumCard sx={{ p: { xs: 2.2, md: 2.6 }, borderRadius: 4 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box sx={{ width: 44, height: 44, borderRadius: 2.6, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.10)', color: '#ea7600' }}><AutoAwesomeIcon /></Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={850}>{t('recruiterDashboard.overviewEyebrow', 'Recruiting at a glance')}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: .25, lineHeight: 1.7 }}>{t('recruiterDashboard.overviewEyebrowBody', 'Core hiring metrics, candidate management and AI interview/report actions stay available on every plan. Advanced analytics and the AI HR Assistant unlock on Go and Pro.')}</Typography>
            </Box>
          </Stack>
        </PremiumCard>
        <PremiumCard sx={{ p: { xs: 2.2, md: 2.6 }, borderRadius: 4 }}>
          <Typography variant="caption" color="text.secondary">{t('recruiterDashboard.liveStatus', 'Live workspace')}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: .55 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main', boxShadow: '0 0 0 5px rgba(34,197,94,.10)' }} />
            <Typography fontWeight={850}>{t('recruiterDashboard.dataSynced', 'Hiring data synced')}</Typography>
          </Stack>
        </PremiumCard>
      </Box>

      <Grid container spacing={3.5} sx={{ mb: 3.5 }} data-tour="recruiter-dashboard-stats">
        <Grid item xs={6} lg={3}><PremiumMetricCard title={t('recruiterDashboard.activeJobs')} value={overview.activeJobs ?? '—'} subtitle={t('recruiterDashboard.totalJobsSubtitle', { count: overview.totalJobs ?? 0 })} icon={<WorkIcon />} color="primary" /></Grid>
        <Grid item xs={6} lg={3}><PremiumMetricCard title={t('recruiterDashboard.applications')} value={overview.totalApplications ?? '—'} subtitle={metrics.acceptanceRate == null ? t('recruiterDashboard.noOutcomesYet') : t('recruiterDashboard.acceptedPct', { pct: metrics.acceptanceRate })} icon={<PeopleIcon />} color="primary" /></Grid>
        <Grid item xs={6} lg={3}><PremiumMetricCard title={t('recruiterDashboard.interviewCompletion')} value={metrics.completionRate == null ? '—' : `${metrics.completionRate}%`} subtitle={t('recruiterDashboard.completedCount', { count: overview.completedInterviews ?? 0 })} icon={<VideoCallIcon />} color="primary" /></Grid>
        <Grid item xs={6} lg={3}><PremiumMetricCard title={t('recruiterDashboard.averageScore')} value={metrics.averageScore == null ? '—' : `${metrics.averageScore}%`} subtitle={metrics.averageMinutes == null ? t('recruiterDashboard.noCompletedDurations') : t('recruiterDashboard.averageMinutes', { minutes: metrics.averageMinutes })} icon={<CheckCircleIcon />} color="primary" /></Grid>
      </Grid>

      <Grid container spacing={3.5}>
        <Grid item xs={12} lg={8}>
          <PremiumChartCard title={t('recruiterDashboard.applicationTrend')}>
            {(overview.applicationsOverTime || []).length ? <ResponsiveContainer width="100%" height={280}><AreaChart data={overview.applicationsOverTime}><defs><linearGradient id="dashboard-application-trend" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={tokens.indigo[600]} stopOpacity={0.36} /><stop offset="100%" stopColor={tokens.indigo[600]} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="value" name={t('recruiterDashboard.applicationsSeriesName')} stroke={tokens.indigo[600]} strokeWidth={3} fill="url(#dashboard-application-trend)" /></AreaChart></ResponsiveContainer> : <EmptyState title={t('recruiterDashboard.noApplicationTrend')} description={t('recruiterDashboard.noApplicationTrendDescription')} icon={PeopleIcon} />}
          </PremiumChartCard>
        </Grid>
        <Grid item xs={12} lg={4}>
          <PremiumChartCard title={t('recruiterDashboard.pipelineMix')}>
            {(overview.applicationStatuses || []).length ? <ResponsiveContainer width="100%" height={280}><PieChart><Pie data={(overview.applicationStatuses || []).map(item => ({ ...item, label: localizeStatus(item.label, language) }))} dataKey="value" nameKey="label" innerRadius={62} outerRadius={94} paddingAngle={3}>{overview.applicationStatuses.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title={t('recruiterDashboard.noPipelineData')} description={t('recruiterDashboard.noPipelineDataDescription')} icon={PeopleIcon} />}
          </PremiumChartCard>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card><CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}><Box><Typography fontWeight={750}>{t('recruiterDashboard.hiringFunnel')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.hiringFunnelSubtitle')}</Typography></Box><Chip label={metrics.completionRate == null ? t('recruiterDashboard.noCompletionData') : t('recruiterDashboard.completionPct', { pct: metrics.completionRate })} size="small" color="primary" variant="outlined" /></Box>
            {(overview.hiringFunnel || []).length ? <ResponsiveContainer width="100%" height={250}><BarChart data={(overview.hiringFunnel || []).map(item => ({ ...item, label: localizeStatus(item.label, language) }))}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" name={t('recruiterDashboard.candidatesSeriesName')} fill={tokens.violet[600]} radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title={t('recruiterDashboard.noFunnelData')} description={t('recruiterDashboard.noFunnelDataDescription')} icon={WorkIcon} />}
          </CardContent></Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}>
            <Typography fontWeight={750}>{t('recruiterDashboard.recentNotifications')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.recentNotificationsSubtitle')}</Typography>
            <Stack spacing={1.25} sx={{ mt: 2 }}>{data.notifications.length ? data.notifications.map((notification) => <Box key={notification.id} sx={{ p: 1.25, borderRadius: 2, bgcolor: notification.isRead ? 'transparent' : 'action.hover', border: '1px solid', borderColor: 'divider' }}><Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}><Typography variant="body2" fontWeight={notification.isRead ? 500 : 700}>{notification.title}</Typography><Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>{fmtTimeAgo(notification.createdAt)}</Typography></Box><Typography variant="caption" color="text.secondary">{notification.message}</Typography></Box>) : <EmptyState title={t('recruiterDashboard.noNotifications')} description={t('recruiterDashboard.noNotificationsDescription')} />}</Stack>
          </CardContent></Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('recruiterDashboard.recentActivity')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.recentActivitySubtitle')}</Typography><Box sx={{ mt: 2 }}><ActivityTimeline activities={data.activities} compact /></Box></CardContent></Card>
        </Grid>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('recruiterDashboard.recentInterviewStats')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.recentInterviewStatsSubtitle')}</Typography><Stack spacing={1.25} sx={{ mt: 2 }}>{recentSessions.length ? recentSessions.map((session) => <Box key={session.id} sx={{ display: 'flex', gap: 1.25, alignItems: 'center', p: 1.15, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}><AccessTimeIcon fontSize="small" color={session.endedAt ? 'success' : 'primary'} /><Box sx={{ flex: 1, minWidth: 0 }}><Typography variant="body2" fontWeight={650}>{session.endedAt ? t('recruiterDashboard.completedInterview') : t('recruiterDashboard.interviewInProgress')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.startedAgo', { time: fmtTimeAgo(session.startedAt) })}</Typography></Box>{session.score != null && <Chip label={`${session.score}%`} size="small" color="primary" />}</Box>) : <EmptyState title={t('recruiterDashboard.noInterviewsYet')} description={t('recruiterDashboard.noInterviewsYetDescription')} icon={VideoCallIcon} />}</Stack></CardContent></Card>
        </Grid>

        <Grid item xs={12}>
          <Card><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('recruiterDashboard.topJobs')}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.topJobsSubtitle')}</Typography><Stack spacing={1.1} sx={{ mt: 2 }}>{(overview.topJobs || []).length ? overview.topJobs.map((job) => <Box key={job.jobId} sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 2, alignItems: 'center', p: 1.3, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}><Typography variant="body2" fontWeight={700} noWrap>{job.jobTitle}</Typography><Typography variant="caption" color="text.secondary">{t('recruiterDashboard.jobStats', { applications: job.applications, completed: job.completedInterviews })}</Typography><Chip label={job.averageScore == null ? t('recruiterDashboard.noScoreYet') : t('recruiterDashboard.averageScorePct', { pct: job.averageScore })} size="small" color={job.averageScore == null ? 'default' : 'primary'} variant="outlined" /></Box>) : <EmptyState title={t('recruiterDashboard.noJobPerformance')} description={t('recruiterDashboard.noJobPerformanceDescription')} icon={WorkIcon} />}</Stack></CardContent></Card>
        </Grid>
      </Grid>
    </Box>
  );
}
