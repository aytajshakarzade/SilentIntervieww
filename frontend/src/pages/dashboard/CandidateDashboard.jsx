import { useState, useEffect } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, Button, Stack, Chip,
  Avatar, List, ListItem, ListItemText, Skeleton, LinearProgress,
} from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';
import StatCard from '../../components/ui/StatCard';
import EmptyState from '../../components/ui/EmptyState';
import ScoreRing from '../../components/ui/ScoreRing';
import { useJobs } from '../../hooks/useJobs';
import { interviewService } from '../../services/interviewService';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { fmtTimeAgo, fmtScore, truncate } from '../../utils/formatters';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';
import { PremiumCard, PremiumButton, PremiumMetricCard } from '../../components/design';

export default function CandidateDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobs, loading: jobsLoading } = useJobs();
  const [applications, setApplications] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      interviewService.applications.getAll(),
      interviewService.reports.getAll(),
    ]).then(([appsResult, repsResult]) => {
      const apps = appsResult.status === 'fulfilled' ? appsResult.value : [];
      const reps = repsResult.status === 'fulfilled' ? repsResult.value : [];
      setApplications(Array.isArray(apps) ? apps : (apps?.items ?? []));
      setReports(Array.isArray(reps) ? reps : (reps?.items ?? []));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const completedCount = applications.filter((a) => a.status === 'InterviewCompleted').length;
  const latestReport = reports[reports.length - 1];
  const avgScore = reports.length ? Math.round(reports.reduce((s, r) => s + (r.score || 0), 0) / reports.length) : null;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('candidateDashboard.welcomeBack', { name: user?.name?.split(' ')[0] })}</Typography>
        <Typography color="text.secondary" variant="body2">{t('candidateDashboard.subtitle')}</Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={3.5} sx={{ mb: 3.5 }} data-tour="candidate-dashboard-stats">
        <Grid item xs={6} md={3}>
          <PremiumMetricCard title={t('candidateDashboard.availableJobs')} value={loading || jobsLoading ? '—' : jobs.length} icon={<VideoCallIcon />} color="primary" />
        </Grid>
        <Grid item xs={6} md={3}>
          <PremiumMetricCard title={t('candidateDashboard.interviewsDone')} value={loading ? '—' : completedCount} icon={<AssignmentTurnedInIcon />} color="primary" />
        </Grid>
        <Grid item xs={6} md={3}>
          <PremiumMetricCard title={t('candidateDashboard.avgScore')} value={loading ? '—' : avgScore != null ? fmtScore(avgScore) : '—'} icon={<EmojiEventsIcon />} color="primary" />
        </Grid>
        <Grid item xs={6} md={3}>
          <PremiumMetricCard title={t('candidateDashboard.bestScore')} value={loading ? '—' : reports.length ? fmtScore(Math.max(...reports.map((r) => r.score || 0))) : '—'} icon={<EmojiEventsIcon />} color="primary" />
        </Grid>
      </Grid>

      <Grid container spacing={3.5}>
        {/* Performance radar */}
        <Grid item xs={12} md={5}>
          <PremiumCard>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>{t('candidateDashboard.latestPerformance')}</Typography>
              {latestReport && <ScoreRing score={latestReport.score} size={56} />}
            </Box>
            {loading ? (
              <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
            ) : !latestReport ? (
              <EmptyState title={t('candidateDashboard.noResultsYet')} description={t('candidateDashboard.noResultsYetDescription')} icon={VideoCallIcon} />
            ) : (
              <Box sx={{ minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1.5 }}>
                <ScoreRing score={latestReport.score} size={132} strokeWidth={10} />
                <Typography variant="body2" color="text.secondary">{t('candidateDashboard.basedOnResponses')}</Typography>
              </Box>
            )}
            {latestReport?.feedback && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2, borderLeft: `3px solid ${tokens.indigo[600]}` }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{t('candidateDashboard.automatedFeedback')}</Typography>
                <Typography variant="body2">{latestReport.feedback}</Typography>
              </Box>
            )}
          </PremiumCard>
        </Grid>

        {/* Available interviews */}
        <Grid item xs={12} md={7}>
          <PremiumCard data-tour="candidate-dashboard-available">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={600}>{t('candidateDashboard.availableInterviews')}</Typography>
              <PremiumButton size="small" onClick={() => navigate(ROUTES.CANDIDATE_INTERVIEWS)}>{t('candidateDashboard.seeAll')}</PremiumButton>
            </Box>
            {jobsLoading ? (
              <Stack spacing={1.5}>{Array(4).fill(0).map((_, i) => <Skeleton key={i} height={72} sx={{ borderRadius: 2 }} />)}</Stack>
            ) : jobs.length === 0 ? (
              <EmptyState title={t('candidateDashboard.noInterviewsAvailable')} description={t('candidateDashboard.checkBackSoon')} />
            ) : (
              <Stack spacing={1.5}>
                {jobs.slice(0, 4).map((job) => {
                  const app = applications.find((a) => a.jobId === job.id);
                  const done = Boolean(app);
                  return (
                    <Box
                      key={job.id}
                      sx={{
                        p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                        display: 'flex', alignItems: 'center', gap: 2,
                        bgcolor: done ? 'action.hover' : 'background.paper',
                      }}
                    >
                      <Avatar sx={{ bgcolor: done ? 'action.disabledBackground' : tokens.indigo[600], width: 40, height: 40, fontSize: '0.75rem' }}>
                        {job.title?.[0] || 'J'}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{job.title}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{truncate(job.description || job.requirements, 55)}</Typography>
                      </Box>
                      {done ? (
                        <Chip label={t('candidateDashboard.completed')} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      ) : (
                        <PremiumButton
                          variant="contained"
                          size="small"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => navigate(`${ROUTES.CANDIDATE_INTERVIEWS}/${job.id}`)}
                        >
                          {t('candidateDashboard.start')}
                        </PremiumButton>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </PremiumCard>
        </Grid>
      </Grid>
    </Box>
  );
}
