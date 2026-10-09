import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Chip,
  Divider, Drawer, FormControl, Grid, IconButton, InputAdornment,
  InputLabel, List, ListItem, MenuItem, Select, Skeleton, Stack,
  TablePagination, TextField, ToggleButton, ToggleButtonGroup, Tooltip,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import FlagCircleOutlinedIcon from '@mui/icons-material/FlagCircleOutlined';
import EmptyState from '../../components/ui/EmptyState';
import ScoreRing from '../../components/ui/ScoreRing';
import StatCard from '../../components/ui/StatCard';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { interviewService } from '../../services/interviewService';
import { jobService } from '../../services/jobService';
import { fmtDate, fmtTimeAgo } from '../../utils/formatters';
import { getErrorMessage } from '../../utils/errorUtils';
import { getFavorites, toggleFavorite, getArchived, toggleArchived } from '../../utils/reportPrefs';
import { tokens } from '../../theme/index';
import { useTranslation } from '../../i18n';

const toItems = (value) => Array.isArray(value) ? value : (value?.items ?? []);
const durationMinutes = (session) => session?.startedAt && session?.endedAt
  ? Math.max(0, Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000))
  : null;

const ROWS_PER_PAGE_OPTIONS = [6, 12, 24, 48];

// Keep the candidate-facing preview focused on job-related evidence. Older
// reports may contain camera-derived or speculative labels, so do not surface
// those as conclusions about a candidate's ability or suitability.
const NON_JOB_SIGNAL = /eye\s*contact|facial expression|body language|stress level|emotion stability|culture fit|professionalism|confidence|hiring recommendation|pass probability/i;
const keepCandidateReportItem = (value) => typeof value === 'string' && !NON_JOB_SIGNAL.test(value);

function ScoreChip({ score, t }) {
  const color = score == null ? 'default' : score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error';
  return <Chip size="small" color={color} label={score == null ? t('reports.noScore') : `${Math.round(score)}%`} sx={{ fontWeight: 700 }} />;
}

export default function ReportsListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState({ reports: [], sessions: [], applications: [], jobs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [view, setView] = useState('grid');
  const [showArchived, setShowArchived] = useState(false);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);

  const [favorites, setFavorites] = useState(() => getFavorites());
  const [archived, setArchived] = useState(() => getArchived());

  const [previewReport, setPreviewReport] = useState(null);

  const SORT_OPTIONS = [
    { value: 'createdAt:desc', label: t('reports.sortNewest') },
    { value: 'createdAt:asc', label: t('reports.sortOldest') },
    { value: 'score:desc', label: t('reports.sortHighestScore') },
    { value: 'score:asc', label: t('reports.sortLowestScore') },
  ];

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [reports, sessions, applications, jobs] = await Promise.all([
        interviewService.reports.getAll({ pageSize: 200 }),
        interviewService.sessions.getAll({ pageSize: 200 }),
        interviewService.applications.getAll({ pageSize: 200 }),
        jobService.getAll({ pageSize: 200 }),
      ]);
      setData({
        reports: toItems(reports), sessions: toItems(sessions),
        applications: toItems(applications), jobs: toItems(jobs),
      });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reports = useMemo(() => data.reports.map((report) => {
    const session = data.sessions.find((item) => item.id === report.interviewSessionId);
    const application = session ? data.applications.find((item) => item.id === session.jobApplicationId) : null;
    const job = application ? data.jobs.find((item) => item.id === application.jobId) : null;
    return { ...report, session, application, job };
  }).filter((report) => report.session && report.application && report.job), [data]);

  const filtered = useMemo(() => {
    let list = reports;
    if (!showArchived) list = list.filter((r) => !archived.has(r.id));
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((r) =>
        (r.job?.title || '').toLowerCase().includes(needle) ||
        (r.feedback || '').toLowerCase().includes(needle) ||
        (r.aiSummary || '').toLowerCase().includes(needle));
    }
    if (minScore !== '') list = list.filter((r) => (r.score ?? 0) >= Number(minScore));
    const [key, dir] = sort.split(':');
    list = [...list].sort((a, b) => {
      const av = key === 'score' ? (a.score ?? -1) : new Date(a.createdAt).getTime();
      const bv = key === 'score' ? (b.score ?? -1) : new Date(b.createdAt).getTime();
      return dir === 'asc' ? av - bv : bv - av;
    });
    // Favorites always float to the top within the current sort.
    return [...list].sort((a, b) => (favorites.has(b.id) ? 1 : 0) - (favorites.has(a.id) ? 1 : 0));
  }, [reports, search, minScore, sort, favorites, archived, showArchived]);

  const stats = useMemo(() => {
    const scores = reports.map((r) => r.score).filter((s) => s != null);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const topScore = scores.length ? Math.round(Math.max(...scores)) : null;
    return {
      total: reports.length,
      favorites: reports.filter((r) => favorites.has(r.id)).length,
      avgScore,
      topScore,
    };
  }, [reports, favorites]);

  // Reset to page 0 whenever the effective result set changes shape.
  useEffect(() => { setPage(0); }, [search, minScore, sort, showArchived, rowsPerPage]);

  const pageStart = page * rowsPerPage;
  const paged = useMemo(() => filtered.slice(pageStart, pageStart + rowsPerPage), [filtered, pageStart, rowsPerPage]);

  const handleFavorite = (event, id) => {
    event.stopPropagation();
    setFavorites(toggleFavorite(id));
  };
  const handleArchive = (event, id) => {
    event.stopPropagation();
    setArchived(toggleArchived(id));
  };
  const handlePreview = (event, report) => {
    event.stopPropagation();
    setPreviewReport(report);
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
            <Grid item xs={12} sm={6} md={4} key={i}><Skeleton variant="rounded" height={190} /></Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight={800} sx={{ mb: 2, letterSpacing: '-0.03em' }}>{t('reports.title')}</Typography>
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>{t('reports.retry')}</Button>}>{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }} data-tour="reports-list-header">
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>{t('reports.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('reports.subtitle')}
        </Typography>
      </Box>

      {/* Stat summary */}
      <Grid container spacing={3.0} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <StatCard title={t('reports.totalReports')} value={stats.total} icon={AssessmentIcon} color={tokens.brand[600]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('reports.averageScore')} value={stats.avgScore != null ? `${stats.avgScore}%` : '—'} icon={TrendingUpIcon} color={tokens.sky[500]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('reports.bestScore')} value={stats.topScore != null ? `${stats.topScore}%` : '—'} icon={AssessmentIcon} color={tokens.emerald[500]} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard title={t('reports.favorited')} value={stats.favorites} icon={StarIcon} color={tokens.amber[500]} />
        </Grid>
      </Grid>

      {/* Toolbar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <TextField
              size="small"
              placeholder={t('reports.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="disabled" /></InputAdornment> }}
              aria-label={t('reports.searchAriaLabel')}
            />
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="min-score-label">{t('reports.minScore')}</InputLabel>
              <Select labelId="min-score-label" label={t('reports.minScore')} value={minScore} onChange={(e) => setMinScore(e.target.value)}>
                <MenuItem value="">{t('reports.anyScore')}</MenuItem>
                <MenuItem value={80}>80%+</MenuItem>
                <MenuItem value={60}>60%+</MenuItem>
                <MenuItem value={40}>40%+</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="sort-label">{t('reports.sortBy')}</InputLabel>
              <Select labelId="sort-label" label={t('reports.sortBy')} value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORT_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Tooltip title={showArchived ? t('reports.hideArchived') : t('reports.showArchived')}>
              <Button
                size="small"
                variant={showArchived ? 'contained' : 'outlined'}
                color="inherit"
                startIcon={showArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                onClick={() => setShowArchived((v) => !v)}
              >
                {t('reports.archived')}
              </Button>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setView(v)} aria-label={t('reports.layout')}>
              <ToggleButton value="grid" aria-label={t('reports.gridView')}><GridViewIcon fontSize="small" /></ToggleButton>
              <ToggleButton value="list" aria-label={t('reports.listView')}><ViewListIcon fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </CardContent>
      </Card>

      {!filtered.length ? (
        <Card><CardContent sx={{ py: 5 }}>
          <EmptyState
            title={reports.length ? t('reports.noMatchTitle') : t('reports.noReportsTitle')}
            description={reports.length ? t('reports.noMatchDescription') : t('reports.noReportsDescription')}
            icon={AssessmentIcon}
            action={reports.length ? (
              <Button
                variant="contained"
                startIcon={<CloseIcon />}
                onClick={() => { setSearch(''); setMinScore(''); setShowArchived(false); }}
              >
                {t('reports.resetFilters')}
              </Button>
            ) : null}
          />
        </CardContent></Card>
      ) : (
        <>
          {view === 'grid' ? (
            <Grid container spacing={3.0} data-tour="reports-list">
              {paged.map((report) => (
                <Grid item xs={12} sm={6} md={4} key={report.id}>
                  <ReportCard
                    report={report}
                    t={t}
                    isFavorite={favorites.has(report.id)}
                    isArchived={archived.has(report.id)}
                    onOpen={() => navigate(`/candidate/reports/${report.id}`)}
                    onFavorite={(e) => handleFavorite(e, report.id)}
                    onArchive={(e) => handleArchive(e, report.id)}
                    onPreview={(e) => handlePreview(e, report)}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Card>
              <List disablePadding>
                {paged.map((report, index) => (
                  <ReportRow
                    key={report.id}
                    report={report}
                    t={t}
                    divider={index < paged.length - 1}
                    isFavorite={favorites.has(report.id)}
                    isArchived={archived.has(report.id)}
                    onOpen={() => navigate(`/candidate/reports/${report.id}`)}
                    onFavorite={(e) => handleFavorite(e, report.id)}
                    onArchive={(e) => handleArchive(e, report.id)}
                    onPreview={(e) => handlePreview(e, report)}
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
              labelRowsPerPage={t('reports.reportsPerPage')}
              sx={{ '.MuiTablePagination-toolbar': { flexWrap: 'wrap', minHeight: 56 } }}
            />
          </Card>
        </>
      )}

      <ReportPreviewDrawer
        report={previewReport}
        t={t}
        open={!!previewReport}
        onClose={() => setPreviewReport(null)}
        onOpenFull={() => {
          if (previewReport) navigate(`/candidate/reports/${previewReport.id}`);
          setPreviewReport(null);
        }}
        isFavorite={previewReport ? favorites.has(previewReport.id) : false}
        onFavorite={(e) => previewReport && handleFavorite(e, previewReport.id)}
      />
    </Box>
  );
}

function ReportCard({ report, t, isFavorite, isArchived, onOpen, onFavorite, onArchive, onPreview }) {
  const minutes = durationMinutes(report.session);
  return (
    <Card
      sx={{
        height: '100%',
        position: 'relative',
        opacity: isArchived ? 0.6 : 1,
        transition: 'transform 200ms cubic-bezier(0.16,1,0.3,1), box-shadow 200ms ease',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 6 },
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.25, zIndex: 1 }}>
        <Tooltip title={t('reports.quickPreview')}>
          <IconButton size="small" onClick={onPreview} aria-label={t('reports.previewReportAria')}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={isFavorite ? t('reports.removeFromFavorites') : t('reports.addToFavorites')}>
          <IconButton size="small" onClick={onFavorite} aria-label={t('reports.toggleFavoriteAria')}>
            {isFavorite ? <StarIcon fontSize="small" sx={{ color: tokens.amber[500] }} /> : <StarBorderIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Tooltip title={isArchived ? t('reports.unarchive') : t('reports.archive')}>
          <IconButton size="small" onClick={onArchive} aria-label={t('reports.toggleArchiveAria')}>
            {isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <CardActionArea onClick={onOpen} sx={{ height: '100%', alignItems: 'stretch' }}>
        <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ScoreRing score={report.score} size={52} strokeWidth={5} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={750} noWrap sx={{ pr: 7 }}>{report.job?.title || t('reports.interviewReportFallback')}</Typography>
              <Typography variant="caption" color="text.secondary">{fmtTimeAgo(report.createdAt)}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            <ScoreChip score={report.score} t={t} />
            {report.grade && <Chip size="small" variant="outlined" label={t('reports.grade', { grade: report.grade })} />}
            {isArchived && <Chip size="small" variant="outlined" color="default" label={t('reports.archived')} />}
          </Stack>
          <Stack direction="row" spacing={2} sx={{ mt: 'auto', pt: 0.5 }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <AccessTimeIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">{minutes == null ? '—' : t('reports.minutesShort', { minutes })}</Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ ml: 'auto', color: 'primary.main' }}>
              <Typography variant="caption" fontWeight={700}>{t('reports.viewReport')}</Typography>
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function ReportRow({ report, t, divider, isFavorite, isArchived, onOpen, onFavorite, onArchive, onPreview }) {
  const minutes = durationMinutes(report.session);
  return (
    <ListItem
      disablePadding
      divider={divider}
      secondaryAction={
        <Stack direction="row" spacing={0.25}>
          <Tooltip title={t('reports.quickPreview')}>
            <IconButton size="small" onClick={onPreview} aria-label={t('reports.previewReportAria')}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={isFavorite ? t('reports.removeFromFavorites') : t('reports.addToFavorites')}>
            <IconButton size="small" onClick={onFavorite} aria-label={t('reports.toggleFavoriteAria')}>
              {isFavorite ? <StarIcon fontSize="small" sx={{ color: tokens.amber[500] }} /> : <StarBorderIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title={isArchived ? t('reports.unarchive') : t('reports.archive')}>
            <IconButton size="small" onClick={onArchive} aria-label={t('reports.toggleArchiveAria')}>
              {isArchived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      }
      sx={{ opacity: isArchived ? 0.6 : 1 }}
    >
      <CardActionArea onClick={onOpen} sx={{ py: 1.5, px: 2.5, pr: 14 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <ScoreRing score={report.score} size={40} strokeWidth={4} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography fontWeight={700} noWrap>{report.job?.title || t('reports.interviewReportFallback')}</Typography>
            <Typography variant="caption" color="text.secondary">{fmtDate(report.createdAt)} · {minutes == null ? t('reports.durationUnavailable') : t('reports.minutesShort', { minutes })}</Typography>
          </Box>
          <ScoreChip score={report.score} t={t} />
          {report.grade && <Chip size="small" variant="outlined" label={t('reports.grade', { grade: report.grade })} sx={{ display: { xs: 'none', sm: 'flex' } }} />}
        </Stack>
      </CardActionArea>
    </ListItem>
  );
}

function ReportPreviewDrawer({ report, t, open, onClose, onOpenFull, isFavorite, onFavorite }) {
  const minutes = report ? durationMinutes(report.session) : null;
  const strengths = (report?.strengths || []).filter(keepCandidateReportItem);
  const weaknesses = (report?.weaknesses || []).filter(keepCandidateReportItem);
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100vw', sm: 420 } } }}>
      {report && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight={750}>{report.job?.title || t('reports.interviewReportFallback')}</Typography>
              <Typography variant="caption" color="text.secondary">{t('reports.completedOn', { date: fmtDate(report.createdAt) })}</Typography>
            </Box>
            <IconButton onClick={onClose} size="small" aria-label={t('reports.closePreviewAria')}><CloseIcon /></IconButton>
          </Box>
          <Divider />
          <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 3 }}>
            <Stack alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
              <ScoreRing score={report.score} size={96} strokeWidth={8} />
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="center">
                <ScoreChip score={report.score} t={t} />
                {report.grade && <Chip size="small" variant="outlined" label={t('reports.grade', { grade: report.grade })} />}
              </Stack>
            </Stack>

            <Stack alignItems="center" spacing={0.5} sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={800}>{minutes == null ? '—' : t('reports.minutesShortest', { minutes })}</Typography>
              <Typography variant="caption" color="text.secondary">{t('reports.duration')}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
                {t('reportViewer.scoreDisclaimer')}
              </Typography>
            </Stack>

            {!!strengths.length && (
              <Box sx={{ mb: 3 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                  <ThumbUpAltOutlinedIcon sx={{ fontSize: 18, color: tokens.emerald[500] }} />
                  <Typography variant="subtitle2" fontWeight={750}>{t('reports.strengths')}</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  {strengths.slice(0, 3).map((item, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">• {item}</Typography>
                  ))}
                </Stack>
              </Box>
            )}

            {!!weaknesses.length && (
              <Box sx={{ mb: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                  <FlagCircleOutlinedIcon sx={{ fontSize: 18, color: tokens.rose[500] }} />
                  <Typography variant="subtitle2" fontWeight={750}>{t('reports.areasToImprove')}</Typography>
                </Stack>
                <Stack spacing={0.5}>
                  {weaknesses.slice(0, 3).map((item, i) => (
                    <Typography key={i} variant="body2" color="text.secondary">• {item}</Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </Box>
          <Divider />
          <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5 }}>
            <Button
              fullWidth
              variant="outlined"
              color="inherit"
              startIcon={isFavorite ? <StarIcon sx={{ color: tokens.amber[500] }} /> : <StarBorderIcon />}
              onClick={onFavorite}
            >
              {isFavorite ? t('reports.favorited') : t('reports.favorite')}
            </Button>
            <Button fullWidth variant="contained" endIcon={<OpenInFullIcon />} onClick={onOpenFull}>
              {t('reports.openFullReport')}
            </Button>
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
