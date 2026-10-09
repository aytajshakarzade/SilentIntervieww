import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, FormControl, Grid, MenuItem, Select, Skeleton, Stack, Typography } from '@mui/material';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { analyticsApi } from '../../api/analyticsApi';
import { interviewService } from '../../services/interviewService';
import EmptyState from '../../components/ui/EmptyState';
import StatCard from '../../components/ui/StatCard';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';

const COLORS = [tokens.indigo[600], tokens.violet[600], '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e'];
const toItems = (value) => Array.isArray(value) ? value : (value?.items ?? []);
const rate = (value, total) => total ? Math.round((value || 0) * 100 / total) : null;

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState({ overview: null, sessions: [], reports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [advancedLocked, setAdvancedLocked] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setAdvancedLocked(false);
      const [overview, sessions, reports] = await Promise.all([
        analyticsApi.getOverview(period),
        interviewService.sessions.getAll({ pageSize: 100 }),
        interviewService.reports.getAll({ pageSize: 100 }),
      ]);
      setData({ overview, sessions: toItems(sessions), reports: toItems(reports) });
    } catch (requestError) {
      const status = requestError?.response?.status || requestError?.originalError?.response?.status;
      if (status === 402) {
        try {
          const [overview, sessions, reports] = await Promise.all([
            analyticsApi.getCoreOverview(period),
            interviewService.sessions.getAll({ pageSize: 100 }),
            interviewService.reports.getAll({ pageSize: 100 }),
          ]);
          setData({ overview, sessions: toItems(sessions), reports: toItems(reports) });
          setAdvancedLocked(true);
          setError('');
          return;
        } catch (coreError) {
          setError(coreError?.message || t('analytics.loadError'));
        }
      } else {
        setError(requestError?.message || t('analytics.loadError'));
      }
    } finally { setLoading(false); }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const overview = data.overview || {};
  const metrics = useMemo(() => {
    const sessions = data.sessions.filter((session) => session.startedAt && session.endedAt);
    const averageDuration = sessions.length
      ? Math.round(sessions.reduce((sum, session) => sum + Math.max(0, new Date(session.endedAt) - new Date(session.startedAt)), 0) / sessions.length / 60000)
      : null;
    return {
      completionRate: rate(overview.completedInterviews, overview.totalApplications),
      acceptanceRate: rate(overview.acceptedApplications, overview.totalApplications),
      rejectionRate: rate(overview.rejectedApplications, overview.totalApplications),
      averageDuration,
    };
  }, [data.sessions, overview]);

  const chartSkeleton = <Skeleton variant="rounded" height={270} />;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Box><Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('analytics.title')}</Typography><Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>{t('analytics.subtitle')}</Typography></Box>
        <Stack direction="row" spacing={1}><FormControl size="small"><Select value={period} onChange={(event) => setPeriod(event.target.value)}>{[['daily','periodDaily'],['weekly','periodWeekly'],['monthly','periodMonthly'],['yearly','periodYearly']].map(([value,key]) => <MenuItem key={value} value={value}>{t(`analytics.${key}`)}</MenuItem>)}</Select></FormControl><Button variant="outlined" startIcon={<RefreshIcon />} onClick={load}>{t('analytics.refresh')}</Button></Stack>
      </Box>
      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{t('analytics.retry')}</Button>} sx={{ mb: 3 }}>{error}</Alert>}
      {advancedLocked && <Alert severity="info" sx={{ mb: 3, borderRadius: 3 }} action={<Button color="inherit" size="small" href="/billing">{t('analytics.upgrade', 'Upgrade')}</Button>}>
        {t('analytics.advancedLocked', 'Core analytics are available on your current plan. Upgrade to Go or Pro to unlock advanced hiring insights.')}
      </Alert>}

      <Grid container spacing={2.25} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.applications')} value={overview.totalApplications ?? '—'} subtitle={t('analytics.candidatesCount', { count: overview.totalCandidates ?? 0 })} icon={PeopleIcon} color={tokens.indigo[600]} loading={loading} /></Grid>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.completionRate')} value={metrics.completionRate == null ? '—' : `${metrics.completionRate}%`} subtitle={t('analytics.interviewsCount', { count: overview.completedInterviews ?? 0 })} icon={VideoCallIcon} color="#0ea5e9" loading={loading} /></Grid>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.acceptanceRate')} value={metrics.acceptanceRate == null ? '—' : `${metrics.acceptanceRate}%`} subtitle={t('analytics.acceptedCount', { count: overview.acceptedApplications ?? 0 })} icon={CheckCircleIcon} color="#10b981" loading={loading} /></Grid>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.rejectionRate')} value={metrics.rejectionRate == null ? '—' : `${metrics.rejectionRate}%`} subtitle={t('analytics.rejectedCount', { count: overview.rejectedApplications ?? 0 })} icon={CancelIcon} color="#f43f5e" loading={loading} /></Grid>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.averageScore')} value={overview.averageInterviewScore == null ? '—' : `${overview.averageInterviewScore}%`} subtitle={t('analytics.reportsCount', { count: data.reports.length })} icon={AssessmentIcon} color={tokens.violet[600]} loading={loading} /></Grid>
        <Grid item xs={6} md={3}><StatCard title={t('analytics.averageDuration')} value={metrics.averageDuration == null ? '—' : t('analytics.minutesValue', { minutes: metrics.averageDuration })} subtitle={metrics.averageDuration == null ? t('analytics.noCompletedSessions') : t('analytics.completedInterviews')} icon={AccessTimeIcon} color="#f59e0b" loading={loading} /></Grid>
      </Grid>

      <Grid container spacing={2.5} data-tour="analytics-charts">
        <Grid item xs={12} lg={8}><Card><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('analytics.applicationTrend')}</Typography><Typography variant="caption" color="text.secondary">{t('analytics.applicationTrendSubtitle')}</Typography><Box sx={{ mt: 2 }}>{loading ? chartSkeleton : (overview.applicationsOverTime || []).length ? <ResponsiveContainer width="100%" height={270}><AreaChart data={overview.applicationsOverTime}><defs><linearGradient id="analytics-application-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={tokens.indigo[600]} stopOpacity={0.34} /><stop offset="1" stopColor={tokens.indigo[600]} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="value" name={t('analytics.applicationsSeriesName')} stroke={tokens.indigo[600]} strokeWidth={3} fill="url(#analytics-application-gradient)" /></AreaChart></ResponsiveContainer> : <EmptyState title={t('analytics.noTrendData')} description={t('analytics.noTrendDataDescription')} icon={PeopleIcon} />}</Box></CardContent></Card></Grid>
        <Grid item xs={12} lg={4}><Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('analytics.candidatePipeline')}</Typography><Typography variant="caption" color="text.secondary">{t('analytics.candidatePipelineSubtitle')}</Typography><Box sx={{ mt: 2 }}>{loading ? chartSkeleton : (overview.applicationStatuses || []).length ? <ResponsiveContainer width="100%" height={270}><PieChart><Pie data={overview.applicationStatuses} dataKey="value" nameKey="label" innerRadius={60} outerRadius={92} paddingAngle={3}>{overview.applicationStatuses.map((entry, index) => <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer> : <EmptyState title={t('analytics.noPipelineData')} description={t('analytics.noPipelineDataDescription')} icon={PeopleIcon} />}</Box></CardContent></Card></Grid>
        <Grid item xs={12} md={7}><Card><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('analytics.completionFunnel')}</Typography><Typography variant="caption" color="text.secondary">{t('analytics.completionFunnelSubtitle')}</Typography><Box sx={{ mt: 2 }}>{loading ? <Skeleton variant="rounded" height={245} /> : (overview.hiringFunnel || []).length ? <ResponsiveContainer width="100%" height={245}><BarChart data={overview.hiringFunnel}><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,.22)" /><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name={t('analytics.candidatesSeriesName')} fill={tokens.violet[600]} radius={[7, 7, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title={t('analytics.noFunnelData')} description={t('analytics.noFunnelDataDescription')} icon={VideoCallIcon} />}</Box></CardContent></Card></Grid>
        <Grid item xs={12} md={5}><Card sx={{ height: '100%' }}><CardContent sx={{ p: 3 }}><Typography fontWeight={750}>{t('analytics.topJobs')}</Typography><Typography variant="caption" color="text.secondary">{t('analytics.topJobsSubtitle')}</Typography><Stack spacing={1.2} sx={{ mt: 2 }}>{loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} height={44} />) : (overview.topJobs || []).length ? overview.topJobs.map((job) => <Box key={job.jobId} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center', p: 1.15, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Box><Typography variant="body2" fontWeight={700} noWrap>{job.jobTitle}</Typography><Typography variant="caption" color="text.secondary">{t('analytics.jobStats', { applications: job.applications, completed: job.completedInterviews })}</Typography></Box><Typography variant="body2" fontWeight={750} color="primary.main">{job.averageScore == null ? '—' : `${job.averageScore}%`}</Typography></Box>) : <EmptyState title={t('analytics.noJobData')} description={t('analytics.noJobDataDescription')} icon={AssessmentIcon} />}</Stack></CardContent></Card></Grid>
      </Grid>
    </Box>
  );
}
