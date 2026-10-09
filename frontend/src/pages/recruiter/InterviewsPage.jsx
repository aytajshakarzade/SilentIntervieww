import { useEffect, useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Alert, Chip, Stack,
  ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import DataTable from '../../components/ui/DataTable';
import ScoreRing from '../../components/ui/ScoreRing';
import { interviewService } from '../../services/interviewService';
import { jobService } from '../../services/jobService';
import { fmtDate, fmtScore } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

export default function RecruiterInterviewsPage() {
  const { t } = useTranslation();
  const [sessions, setSessions]     = useState([]);
  const [reports, setReports]       = useState([]);
  const [applications, setApps]     = useState([]);
  const [jobs, setJobs]             = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [filter, setFilter]         = useState('ALL');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      interviewService.sessions.getAll({ pageSize: 100 }),
      interviewService.reports.getAll({ pageSize: 100 }),
      interviewService.applications.getAll({ pageSize: 100 }),
      jobService.getAll({ pageSize: 100 }),
    ])
      .then(([ses, rep, app, j]) => {
        setSessions(Array.isArray(ses)  ? ses  : ses?.items  ?? []);
        setReports( Array.isArray(rep)  ? rep  : rep?.items  ?? []);
        setApps(    Array.isArray(app)  ? app  : app?.items  ?? []);
        setJobs(    Array.isArray(j)    ? j    : j?.items    ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const enriched = useMemo(() => {
    const reportBySession = new Map(reports.map(r => [r.interviewSessionId, r]));
    const appMap          = new Map(applications.map(a => [a.id, a]));
    const jobMap          = new Map(jobs.map(j => [j.id, j]));

    return sessions.map(s => {
      const report = reportBySession.get(s.id) ?? null;
      const app    = appMap.get(s.jobApplicationId) ?? null;
      const job    = app ? jobMap.get(app.jobId) ?? null : null;
      return { ...s, report, app, job, score: report?.score ?? null };
    }).filter((entry) => entry.app && entry.job)
      .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  }, [sessions, reports, applications, jobs]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'DONE':    return enriched.filter(s => s.endedAt);
      case 'ACTIVE':  return enriched.filter(s => !s.endedAt);
      case 'SCORED':  return enriched.filter(s => s.score != null);
      default:        return enriched;
    }
  }, [enriched, filter]);

  const columns = [
    {
      id: 'job', label: t('recruiterInterviews.position'),
      render: r => (
        <Box>
          <Typography variant="body2" fontWeight={600}>{r.job?.title ?? '—'}</Typography>
          <Typography variant="caption" color="text.secondary">{t('recruiterInterviews.started', { date: fmtDate(r.startedAt) })}</Typography>
        </Box>
      ),
      value: r => r.job?.title ?? '',
    },
    {
      id: 'status', label: t('recruiterInterviews.status'),
      render: r => r.endedAt
        ? <Chip icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label={t('recruiterInterviews.completed')} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        : <Chip icon={<PendingIcon    sx={{ fontSize: '14px !important' }} />} label={t('recruiterInterviews.inProgress')} size="small" color="info"    variant="outlined" sx={{ fontSize: '0.7rem' }} />,
      value: r => r.endedAt ? t('recruiterInterviews.completed') : t('recruiterInterviews.inProgress'),
    },
    {
      id: 'score', label: t('recruiterInterviews.score'), align: 'center',
      render: r => (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ScoreRing score={r.score} size={44} strokeWidth={4} />
        </Box>
      ),
      value: r => r.score ?? -1,
    },
    {
      id: 'feedback', label: t('recruiterInterviews.aiFeedback'),
      render: r => r.report?.feedback
        ? <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.report.feedback}</Typography>
        : <Typography variant="caption" color="text.disabled">{t('recruiterInterviews.awaitingCompletion')}</Typography>,
      sortable: false,
    },
    {
      id: 'endedAt', label: t('recruiterInterviews.completedColumn'),
      render: r => <Typography variant="body2" color="text.secondary">{r.endedAt ? fmtDate(r.endedAt) : '—'}</Typography>,
      value: r => r.endedAt ?? '',
    },
  ];

  const completedCount = enriched.filter(s => s.endedAt).length;
  const avgScore = enriched.filter(s => s.score != null).length
    ? Math.round(enriched.filter(s => s.score != null).reduce((sum, s) => sum + s.score, 0) / enriched.filter(s => s.score != null).length)
    : null;

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between',
        gap: 2, mb: 3, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' },
      }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>{t('recruiterInterviews.title')}</Typography>
          <Typography color="text.secondary" variant="body2">
            {t('recruiterInterviews.totalStats', { total: enriched.length, completed: completedCount })}{avgScore != null ? t('recruiterInterviews.avgScoreStats', { score: avgScore }) : ''}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {avgScore != null && (
            <Box sx={{ px: 2, py: 1, bgcolor: 'primary.main', borderRadius: 2, color: 'white', textAlign: 'center' }}>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block', fontSize: '0.65rem' }}>{t('recruiterInterviews.avg')}</Typography>
              <Typography fontWeight={800} fontSize="1rem">{avgScore}%</Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
          {[
            { value: 'ALL',    label: t('recruiterInterviews.all', { count: enriched.length }) },
            { value: 'DONE',   label: t('recruiterInterviews.completedColumn') + ` (${enriched.filter(s => s.endedAt).length})` },
            { value: 'ACTIVE', label: t('recruiterInterviews.inProgress') + ` (${enriched.filter(s => !s.endedAt).length})` },
            { value: 'SCORED', label: t('recruiterInterviews.scored', { count: enriched.filter(s => s.score != null).length }) },
          ].map(f => (
            <ToggleButton key={f.value} value={f.value}
              sx={{ px: 2, fontSize: '0.75rem', textTransform: 'none', fontWeight: 500 }}>
              {f.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Card>
        <CardContent sx={{ p: 2.5 }}>
          <DataTable
            columns={columns}
            rows={filtered}
            loading={loading}
            searchable
            searchPlaceholder={t('recruiterInterviews.searchPlaceholder')}
            rowKey={r => r.id}
            emptyTitle={t('recruiterInterviews.noInterviewsYet')}
            emptyDescription={t('recruiterInterviews.noInterviewsYetDescription')}
            emptyIcon={ListAltIcon}
            defaultSort="startedAt"
            defaultSortDir="desc"
          />
        </CardContent>
      </Card>
    </Box>
  );
}
