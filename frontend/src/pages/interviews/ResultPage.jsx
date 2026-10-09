import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardActionArea, CardContent, Chip,
  Divider, FormControl, Grid, InputAdornment, InputLabel, List, ListItem,
  MenuItem, Select, Skeleton, Stack, TablePagination, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import HistoryIcon from '@mui/icons-material/History';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BusinessIcon from '@mui/icons-material/Business';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmptyState from '../../components/ui/EmptyState';
import ScoreRing from '../../components/ui/ScoreRing';
import StatCard from '../../components/ui/StatCard';
import { interviewService } from '../../services/interviewService';
import { jobService } from '../../services/jobService';
import { companyService } from '../../services/companyService';
import { fmtDate, fmtTimeAgo } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errorUtils';
import { ROUTES } from '../../constants/routes';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';

const toItems = (value) => (Array.isArray(value) ? value : value?.items ?? []);

const durationMinutes = (session) =>
  session?.startedAt && session?.endedAt
    ? Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000))
    : null;

function getStatusOptions(t) {
  return [
    { value: 'all', label: t('resultPage.statusAll') },
    { value: 'completed', label: t('resultPage.statusCompleted') },
    { value: 'awaiting', label: t('resultPage.statusAwaiting') },
    { value: 'in_progress', label: t('resultPage.statusInProgress') },
  ];
}

function getSortOptions(t) {
  return [
    { value: 'date:desc', label: t('resultPage.sortNewest') },
    { value: 'date:asc', label: t('resultPage.sortOldest') },
    { value: 'duration:desc', label: t('resultPage.sortLongestDuration') },
    { value: 'score:desc', label: t('resultPage.sortHighestScore') },
  ];
}

const ROWS_PER_PAGE_OPTIONS = [6, 12, 24, 48];

function deriveStatus(session, hasReport) {
  const completed = session?.status === 'Completed' || !!session?.endedAt;
  if (completed && hasReport) return 'completed';
  if (completed && !hasReport) return 'awaiting';
  return 'in_progress';
}

function getStatusMeta(t) {
  return {
    completed: { label: t('resultPage.statusCompleted'), color: 'success', icon: CheckCircleIcon, dot: tokens.emerald[500] },
    awaiting: { label: t('resultPage.statusAwaiting'), color: 'info', icon: HourglassTopIcon, dot: tokens.sky[500] },
    in_progress: { label: t('resultPage.statusInProgress'), color: 'warning', icon: PlayArrowIcon, dot: tokens.amber[500] },
  };
}

function companyInitials(name = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function StatusChip({ status, t }) {
  const statusMeta = getStatusMeta(t);
  const meta = statusMeta[status] ?? statusMeta.in_progress;
  const Icon = meta.icon;
  return (
    <Chip
      size="small"
      color={meta.color}
      variant={status === 'in_progress' ? 'filled' : 'outlined'}
      icon={<Icon sx={{ fontSize: '14px !important' }} />}
      label={meta.label}
      sx={{ fontWeight: 700, fontSize: '0.7rem' }}
    />
  );
}

export default function ResultPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [data, setData] = useState({ sessions: [], applications: [], jobs: [], companies: [], reports: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('date:desc');
  const [view, setView] = useState('grid');

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sessions, applications, jobs, companies, reports] = await Promise.all([
        interviewService.sessions.getAll({ pageSize: 200 }),
        interviewService.applications.getAll({ pageSize: 200 }),
        jobService.getAll({ pageSize: 200 }),
        companyService.getAll({ pageSize: 200 }),
        interviewService.reports.getAll({ pageSize: 200 }),
      ]);
      setData({
        sessions: toItems(sessions),
        applications: toItems(applications),
        jobs: toItems(jobs),
        companies: toItems(companies),
        reports: toItems(reports),
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Every interview a candidate has ever taken — regardless of whether a
  // report has been generated yet. This is what makes it a *history* page
  // rather than a duplicate of the Reports list.
  const history = useMemo(() => {
    return data.sessions.map((session) => {
      const application = data.applications.find((a) => a.id === session.jobApplicationId) || null;
      const job = application ? data.jobs.find((j) => j.id === application.jobId) : null;
      const company = job ? data.companies.find((c) => c.id === job.companyId) : null;
      const report = data.reports.find((r) => r.interviewSessionId === session.id) || null;
      const entryStatus = deriveStatus(session, !!report);
      return { session, application, job, company, report, status: entryStatus };
    }).filter((entry) => entry.application && entry.job)
      .sort((a, b) => new Date(b.session.startedAt) - new Date(a.session.startedAt));
  }, [data]);

  const stats = useMemo(() => {
    const total = history.length;
    const completed = history.filter((h) => h.status === 'completed').length;
    const inProgress = history.filter((h) => h.status === 'in_progress').length;
    const scores = history.map((h) => h.report?.score).filter((s) => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    return { total, completed, inProgress, avgScore };
  }, [history]);

  const filtered = useMemo(() => {
    let list = history;
    if (status !== 'all') list = list.filter((h) => h.status === status);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((h) =>
        (h.job?.title || '').toLowerCase().includes(needle) ||
        (h.company?.name || '').toLowerCase().includes(needle));
    }
    const [key, dir] = sort.split(':');
    list = [...list].sort((a, b) => {
      let av; let bv;
      if (key === 'duration') { av = durationMinutes(a.session) ?? -1; bv = durationMinutes(b.session) ?? -1; }
      else if (key === 'score') { av = a.report?.score ?? -1; bv = b.report?.score ?? -1; }
      else { av = new Date(a.session.startedAt).getTime(); bv = new Date(b.session.startedAt).getTime(); }
      return dir === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [history, search, status, sort]);

  useEffect(() => { setPage(0); }, [search, status, sort, rowsPerPage]);

  const pageStart = page * rowsPerPage;
  const paged = useMemo(() => filtered.slice(pageStart, pageStart + rowsPerPage), [filtered, pageStart, rowsPerPage]);

  const hasActiveFilters = Boolean(search) || status !== 'all';
  const resetFilters = () => { setSearch(''); setStatus('all'); };

  const handleOpen = (entry) => {
    if (entry.status === 'completed' && entry.report) {
      navigate(`${ROUTES.CANDIDATE_REPORTS}/${entry.report.id}`);
    } else if (entry.job?.id) {
      navigate(`${ROUTES.CANDIDATE_INTERVIEWS}/${entry.job.id}`);
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton width={260} height={44} sx={{ mb: 1 }} />
        <Skeleton width={380} height={22} sx={{ mb: 3 }} />
        <Grid container spacing={3.0} sx={{ mb: 3 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={110} /></Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={64} sx={{ mb: 3 }} />
        <Grid container spacing={3.0}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={200} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 2, letterSpacing: '-0.03em' }}>{t('resultPage.title')}</Typography>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{t('resultPage.retry')}</Button>}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('resultPage.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('resultPage.subtitle')}
        </Typography>
      </Box>

      {/* Stat summary */}
      <Grid container spacing={3.0} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard title={t('resultPage.totalInterviews')} value={stats.total} icon={HistoryIcon} color={tokens.brand[600]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('resultPage.completed')} value={stats.completed} icon={CheckCircleIcon} color={tokens.emerald[500]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('resultPage.inProgress')} value={stats.inProgress} icon={HourglassTopIcon} color={tokens.amber[500]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('resultPage.averageScore')} value={stats.avgScore != null ? `${stats.avgScore}%` : '—'} icon={AssessmentOutlinedIcon} color={tokens.sky[500]} />
        </Grid>
      </Grid>

      {/* Action bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              size="small"
              placeholder={t('resultPage.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="disabled" /></InputAdornment> }}
              aria-label={t('resultPage.searchAriaLabel')}
            />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="status-label">{t('resultPage.status')}</InputLabel>
              <Select labelId="status-label" label={t('resultPage.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
                {getStatusOptions(t).map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="sort-label">{t('resultPage.sortBy')}</InputLabel>
              <Select labelId="sort-label" label={t('resultPage.sortBy')} value={sort} onChange={(e) => setSort(e.target.value)}>
                {getSortOptions(t).map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            {hasActiveFilters && (
              <Tooltip title={t('resultPage.resetFiltersTooltip')}>
                <Button size="small" variant="outlined" color="inherit" startIcon={<FilterAltOffIcon fontSize="small" />} onClick={resetFilters}>
                  {t('resultPage.reset')}
                </Button>
              </Tooltip>
            )}
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label={t('resultPage.layout')}>
              <ToggleButton value="grid" aria-label={t('resultPage.gridView')}><GridViewIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="list" aria-label={t('resultPage.listView')}><ViewListIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      {!filtered.length ? (
        <Card><CardContent sx={{ py: 5 }}>
          <EmptyState
            title={history.length ? t('resultPage.noMatchTitle') : t('resultPage.noneYetTitle')}
            description={history.length
              ? t('resultPage.noMatchDescription')
              : t('resultPage.noneYetDescription')}
            icon={HistoryIcon}
            action={history.length
              ? (hasActiveFilters ? <Button variant="contained" startIcon={<FilterAltOffIcon />} onClick={resetFilters}>{t('resultPage.resetFilters')}</Button> : null)
              : <Button variant="contained" onClick={() => navigate(ROUTES.CANDIDATE_INTERVIEWS)}>{t('resultPage.browseInterviews')}</Button>}
          />
        </CardContent></Card>
      ) : (
        <>
          {view === 'grid' ? (
            <Grid container spacing={3.0}>
              {paged.map((entry) => (
                <Grid item xs={12} sm={6} md={4} key={entry.session.id}>
                  <HistoryCard entry={entry} t={t} onOpen={() => handleOpen(entry)} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card>
              <List disablePadding>
                {paged.map((entry, index) => (
                  <HistoryRow
                    key={entry.session.id}
                    entry={entry}
                    t={t}
                    divider={index < paged.length - 1}
                    onOpen={() => handleOpen(entry)}
                  />
                ))}
              </List>
            </Card>
          )}

          <Card sx={{ mt: 2.5 }}>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => setRowsPerPage(Number(e.target.value))}
              rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
              labelRowsPerPage={t('resultPage.interviewsPerPage')}
              sx={{ '.MuiTablePagination-toolbar': { flexWrap: 'wrap', minHeight: 56 } }}
            />
          </Card>
        </>
      )}
    </Box>
  );
}

function HistoryCard({ entry, t, onOpen }) {
  const { session, job, company, report, status } = entry;
  const statusMeta = getStatusMeta(t);
  const minutes = durationMinutes(session);
  const companyName = company?.name ?? '—';
  const ctaLabel = status === 'completed' ? t('resultPage.viewReport') : status === 'awaiting' ? t('resultPage.viewDetails') : t('resultPage.continueInterview');

  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          bgcolor: statusMeta[status]?.dot ?? tokens.ink[300],
        },
      }}
    >
      <CardActionArea onClick={onOpen} disabled={status === 'in_progress' && !job?.id} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {report ? (
              <ScoreRing score={report.score} size={52} strokeWidth={5} />
            ) : (
              <Avatar sx={{ width: 52, height: 52, borderRadius: 2, bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 700 }}>
                {companyInitials(companyName)}
              </Avatar>
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={750} noWrap>{job?.title || t('resultPage.interviewSessionFallback')}</Typography>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <BusinessIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" noWrap>{companyName}</Typography>
              </Stack>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
            <StatusChip status={status} t={t} />
            <Typography variant="caption" color="text.secondary">{fmtTimeAgo(session.startedAt)}</Typography>
          </Stack>

          <Stack direction="row" spacing={2} sx={{ mt: 'auto', pt: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">{minutes == null ? t('resultPage.inProgressShort') : t('resultPage.minutesShort', { minutes })}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 'auto', color: 'primary.main' }}>
              <Typography variant="caption" fontWeight={700}>{ctaLabel}</Typography>
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function HistoryRow({ entry, t, divider, onOpen }) {
  const { session, job, company, report, status } = entry;
  const minutes = durationMinutes(session);
  const companyName = company?.name ?? '—';
  const ctaLabel = status === 'completed' ? t('resultPage.viewReport') : status === 'awaiting' ? t('resultPage.viewDetails') : t('resultPage.continue');

  return (
    <ListItem disablePadding divider={divider}>
      <CardActionArea onClick={onOpen} sx={{ py: 1.5, px: 2.5 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {report ? (
            <ScoreRing score={report.score} size={40} strokeWidth={4} />
          ) : (
            <Avatar sx={{ width: 40, height: 40, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary', fontWeight: 700, fontSize: '0.75rem' }}>
              {companyInitials(companyName)}
            </Avatar>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={700} noWrap>{job?.title || t('resultPage.interviewSessionFallback')}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {companyName} · {fmtDate(session.startedAt)} · {minutes == null ? t('resultPage.inProgressLower') : t('resultPage.minutesShort', { minutes })}
            </Typography>
          </Box>
          <StatusChip status={status} t={t} />
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main', display: { xs: 'none', sm: 'flex' } }}>
            <Typography variant="caption" fontWeight={700} noWrap>{ctaLabel}</Typography>
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Stack>
        </Stack>
      </CardActionArea>
    </ListItem>
  );
}
