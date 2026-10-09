import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, FormControl, Grid, InputAdornment,
  InputLabel, MenuItem, Select, Skeleton, Stack, Alert, TextField, Typography, Avatar,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReplayIcon from '@mui/icons-material/Replay';
import SearchIcon from '@mui/icons-material/Search';
import WorkIcon from '@mui/icons-material/Work';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import QuizIcon from '@mui/icons-material/Quiz';
import BusinessIcon from '@mui/icons-material/Business';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import { useJobs } from '../../hooks/useJobs';
import { useCompanies } from '../../hooks/useCompanies';
import { interviewService } from '../../services/interviewService';
import { ROUTES } from '../../constants/routes';
import { truncate, fmtSalary } from '../../utils/formatters';
import { useTranslation } from '../../i18n';
import { useInterviewConfig } from '../../hooks/useInterviewConfig';


const CATEGORY_PALETTE = {
  Backend: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  Frontend: { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9' },
  Mobile: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  DevOps: { bg: 'rgba(249,115,22,0.12)', color: '#f97316' },
  QA: { bg: 'rgba(20,184,166,0.12)', color: '#14b8a6' },
  'UI/UX': { bg: 'rgba(244,63,94,0.12)', color: '#f43f5e' },
  AI: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  'Data Science': { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6' },
  Cloud: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  'Cyber Security': { bg: 'rgba(239,68,68,0.12)', color: '#ef4444' },
};
const EXPERIENCE_PALETTE = {
  Junior: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  Mid: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  Senior: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
};
const AVATAR_COLORS = ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#f43f5e','#14b8a6','#f97316','#a855f7','#3b82f6'];

function deriveCategory(title = '', requirements = '', description = '') {
  const t = `${title} ${requirements} ${description}`.toLowerCase();
  if (/cyber.?security|penetration|hacking|soc|siem|firewall|vulnerability|infosec/.test(t)) return 'Cyber Security';
  if (/machine.?learning|deep.?learning|nlp|openai|pytorch|tensorflow|bert|gpt|llm/.test(t)) return 'AI';
  if (/data.?science|data.?scientist|pandas|numpy|jupyter|statistics|tableau|power.?bi/.test(t)) return 'Data Science';
  if (/cloud.?architect|cloud.?engineer|aws|azure|gcp|serverless|lambda|cloud.?infra/.test(t)) return 'Cloud';
  if (/devops|site.?reliability|sre|kubernetes|k8s|docker|terraform|jenkins|ci.?cd|ansible|helm/.test(t)) return 'DevOps';
  if (/\bios\b|\bandroid\b|swift|kotlin|flutter|react.?native|mobile.?dev|xamarin/.test(t)) return 'Mobile';
  if (/ui.?ux|ux.?design|ui.?design|figma|sketch|product.?designer|user.?experience/.test(t)) return 'UI/UX';
  if (/\bqa\b|quality.?assurance|test.?engineer|test.?automation|selenium|cypress|playwright/.test(t)) return 'QA';
  if (/frontend|front.?end|\breact\b|vue|angular|next\.?js|svelte|css|html5|webpack|typescript/.test(t)) return 'Frontend';
  return 'Backend';
}

function deriveExperience(title = '', requirements = '') {
  const t = `${title} ${requirements}`.toLowerCase();
  if (/senior|lead|principal|staff|architect|head of|\bsr\.?\b|expert|5\+|7\+/.test(t)) return 'Senior';
  if (/junior|entry.?level|fresher|graduate|\bintern\b|0.?2 years|beginner|trainee/.test(t)) return 'Junior';
  return 'Mid';
}

function companyInitials(name = '') {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function parseSkills(requirements = '') {
  return requirements.split(/[,;|\n]+/).map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 32).slice(0, 4);
}

const CATEGORY_LABEL_KEYS = {
  Backend: 'categoryBackend', Frontend: 'categoryFrontend', Mobile: 'categoryMobile',
  DevOps: 'categoryDevOps', QA: 'categoryQA', 'UI/UX': 'categoryUiUx', AI: 'categoryAI',
  'Data Science': 'categoryDataScience', Cloud: 'categoryCloud', 'Cyber Security': 'categoryCyberSecurity',
};
const EXPERIENCE_LABEL_KEYS = { Junior: 'experienceJunior', Mid: 'experienceMid', Senior: 'experienceSenior' };

function InterviewCard({ job, company, category, experience, sessionStatus, onStart, onResume, t }) {
  const skills = useMemo(() => parseSkills(job.requirements), [job.requirements]);
  const catStyle = CATEGORY_PALETTE[category] ?? CATEGORY_PALETTE.Backend;
  const expStyle = EXPERIENCE_PALETTE[experience] ?? EXPERIENCE_PALETTE.Mid;
  const companyName = company?.name ?? '—';
  const bgColor = avatarColor(companyName);
  const isCompleted = sessionStatus === 'Completed';
  const isDraft = sessionStatus === 'Draft';

  return (
    <Card sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
      transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1), box-shadow 220ms ease, border-color 220ms ease',
      opacity: isCompleted ? 0.85 : 1,
      '&:hover': { transform: 'translateY(-4px)', boxShadow: 6, borderColor: `${catStyle.color}40` },
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
        background: isCompleted
          ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
          : isDraft
            ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
            : `linear-gradient(90deg, ${catStyle.color} 0%, ${catStyle.color}66 100%)`,
      },
    }}>
      <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75, mb: 2 }}>
          <Avatar sx={{
            bgcolor: isCompleted ? 'action.selected' : bgColor,
            width: 44, height: 44, fontSize: '0.8rem', fontWeight: 700, flexShrink: 0, borderRadius: 1.5,
          }}>
            {companyInitials(companyName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}
              sx={{ lineHeight: 1.3, mb: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={job.title}
            >
              {job.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.35 }}>
                <BusinessIcon sx={{ fontSize: 11, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>{companyName}</Typography>
              </Box>
              {job.salary > 0 && (
                <>
                  <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1 }}>·</Typography>
                  <Typography variant="caption" color="success.main" fontWeight={600} sx={{ lineHeight: 1 }}>{fmtSalary(job.salary)}</Typography>
                </>
              )}
            </Box>
          </Box>
          {isCompleted && (
            <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, ml: 0.5 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
            </Box>
          )}
        </Box>

        <Stack direction="row" spacing={0.75} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.75 }}>
          <Chip label={t(`availableInterviews.${CATEGORY_LABEL_KEYS[category] || 'categoryBackend'}`)} size="small" sx={{ bgcolor: catStyle.bg, color: catStyle.color, fontWeight: 600, fontSize: '0.68rem', height: 22, border: `1px solid ${catStyle.color}28`, borderRadius: 1 }} />
          <Chip label={t(`availableInterviews.${EXPERIENCE_LABEL_KEYS[experience] || 'experienceMid'}`)} size="small" sx={{ bgcolor: expStyle.bg, color: expStyle.color, fontWeight: 600, fontSize: '0.68rem', height: 22, border: `1px solid ${expStyle.color}28`, borderRadius: 1 }} />
          {job.difficulty && (
            <Chip label={job.difficulty} size="small" variant="outlined" sx={{ fontSize: '0.66rem', height: 22, borderRadius: 1 }} />
          )}
          {job.language && (
            <Chip
              label={job.language === 'ru' ? 'Русский' : job.language === 'az' ? 'Azərbaycan dili' : 'English'}
              size="small" variant="outlined" sx={{ fontSize: '0.66rem', height: 22, borderRadius: 1 }}
            />
          )}
          {isDraft && (
            <Chip label={t('availableInterviews.inProgress')} size="small" sx={{ bgcolor: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 600, fontSize: '0.68rem', height: 22, border: '1px solid rgba(245,158,11,0.28)', borderRadius: 1 }} />
          )}
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, lineHeight: 1.65, mb: 2, fontSize: '0.8rem' }}>
          {truncate(job.description || job.requirements, 115)}
        </Typography>

        {skills.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2.5 }}>
            {skills.map((skill) => (
              <Chip key={skill} label={skill} size="small" variant="outlined"
                sx={{ fontSize: '0.67rem', height: 20, borderRadius: 1, fontWeight: 500, color: 'text.secondary', borderColor: 'divider' }} />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pt: 2, borderTop: '1px solid', borderColor: 'divider', mt: 'auto', flexWrap: 'nowrap', minWidth: 0 }}>
          <Stack direction="row" spacing={1.25} sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0 }}>
              <AccessTimeIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" noWrap>{t('availableInterviews.approxMinutes')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, flexShrink: 0 }}>
              <QuizIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary" noWrap>{t('availableInterviews.questionsCount')}</Typography>
            </Box>
          </Stack>

          <Box sx={{ flexShrink: 0, ml: 'auto' }}>
            {isCompleted ? (
              <Chip label={t('availableInterviews.completed')} size="small" color="success" variant="outlined" sx={{ fontSize: '0.7rem', height: 24, borderRadius: 1 }} />
            ) : isDraft ? (
              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={<ReplayIcon sx={{ fontSize: '0.95rem !important' }} />}
                onClick={() => onResume(job)}
                sx={{ fontSize: '0.78rem', px: 1.75, height: 30, minWidth: 0 }}
              >
                {t('availableInterviews.resumeInterview')}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                data-tour="start-interview-btn"
                startIcon={<PlayArrowIcon sx={{ fontSize: '0.95rem !important' }} />}
                onClick={() => onStart(job)}
                sx={{ fontSize: '0.78rem', px: 1.75, height: 30, minWidth: 0 }}
              >
                {t('availableInterviews.startInterview')}
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function PageSkeleton() {
  return (
    <Box>
      <Skeleton variant="text" width={220} height={40} sx={{ mb: 0.5 }} />
      <Skeleton variant="text" width={160} height={22} sx={{ mb: 3 }} />
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        {[300, 160, 160, 140].map((w, i) => <Skeleton key={i} variant="rectangular" width={w} height={40} sx={{ borderRadius: 1 }} />)}
      </Box>
      <Grid container spacing={3.2}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Grid item xs={12} sm={6} lg={4} key={i}>
            <Skeleton variant="rectangular" height={290} sx={{ borderRadius: 2 }} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default function AvailableInterviewsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const CATEGORIES = ['All', 'Backend', 'Frontend', 'Mobile', 'DevOps', 'QA', 'UI/UX', 'AI', 'Data Science', 'Cloud', 'Cyber Security'];
  const { config: interviewConfig } = useInterviewConfig();
  const EXPERIENCE_LEVELS = ['All', ...interviewConfig.experienceLevels];
  const categoryLabel = (cat) => cat === 'All' ? t('availableInterviews.categoryAll') : t(`availableInterviews.${CATEGORY_LABEL_KEYS[cat] || 'categoryBackend'}`);
  const experienceLabel = (lvl) => lvl === 'All' ? t('availableInterviews.experienceAll') : t(`availableInterviews.${EXPERIENCE_LABEL_KEYS[lvl] || 'experienceMid'}`);
  const { jobs, loading: jobsLoading, error: jobsError } = useJobs({ pageSize: 100 });
  const { companies } = useCompanies();
  const [applications, setApplications] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [experienceFilter, setExperienceFilter] = useState('All');

  useEffect(() => {
    Promise.all([
      interviewService.applications.getAll({ pageSize: 200 }),
      interviewService.sessions.getAll({ pageSize: 200 }),
    ])
      .then(([appData, sessionData]) => {
        setApplications(Array.isArray(appData) ? appData : (appData?.items ?? []));
        setSessions(Array.isArray(sessionData) ? sessionData : (sessionData?.items ?? []));
      })
      .catch(() => {});
  }, []);

  const companyMap = useMemo(() => {
    const map = {};
    companies.forEach((c) => { map[c.id] = c; });
    return map;
  }, [companies]);

  const augmentedJobs = useMemo(
    () => jobs.map((job) => ({
      ...job,
      _company: companyMap[job.companyId] ?? null,
      _category: deriveCategory(job.title, job.requirements, job.description),
      _experience: deriveExperience(job.title, job.requirements),
    })),
    [jobs, companyMap],
  );

  // Map jobId -> 'Completed' | 'Draft' | null
  // Backend now returns status: "Completed" or "Draft" on each session DTO
  const jobSessionStatus = useMemo(() => {
    const appsByJob = new Map();
    applications.forEach((a) => {
      const existing = appsByJob.get(a.jobId) || [];
      existing.push(a);
      appsByJob.set(a.jobId, existing);
    });

    const sessionByApp = new Map();
    sessions.forEach((s) => {
      const existing = sessionByApp.get(s.jobApplicationId) || [];
      existing.push(s);
      sessionByApp.set(s.jobApplicationId, existing);
    });

    const result = new Map();
    augmentedJobs.forEach((job) => {
      const jobApps = appsByJob.get(job.id) || [];
      const allSessions = jobApps.flatMap((a) => sessionByApp.get(a.id) || []);
      if (allSessions.length === 0) {
        result.set(job.id, null);
      } else {
        // Completed takes priority over Draft
        const hasCompleted = allSessions.some((s) => s.status === 'Completed' || s.endedAt);
        const hasDraft = allSessions.some((s) => s.status === 'Draft' && !s.endedAt);
        if (hasCompleted) result.set(job.id, 'Completed');
        else if (hasDraft) result.set(job.id, 'Draft');
        else result.set(job.id, null);
      }
    });
    return result;
  }, [augmentedJobs, applications, sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return augmentedJobs.filter((job) => {
      if (q) {
        const haystack = [job.title, job._company?.name ?? '', job.description ?? '', job.requirements ?? '', job._category, job._experience].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (companyFilter && job.companyId !== companyFilter) return false;
      if (categoryFilter !== 'All' && job._category !== categoryFilter) return false;
      if (experienceFilter !== 'All' && job._experience !== experienceFilter) return false;
      return true;
    });
  }, [augmentedJobs, search, companyFilter, categoryFilter, experienceFilter]);

  const hasActiveFilters = Boolean(search) || Boolean(companyFilter) || categoryFilter !== 'All' || experienceFilter !== 'All';
  const resetFilters = () => { setSearch(''); setCompanyFilter(''); setCategoryFilter('All'); setExperienceFilter('All'); };

  const handleStart = (job) => navigate(`${ROUTES.CANDIDATE_INTERVIEWS}/${job.id}`);
  const handleResume = (job) => navigate(`${ROUTES.CANDIDATE_INTERVIEWS}/${job.id}`);

  const statusValues = [...jobSessionStatus.values()];
  const completedCount = statusValues.filter((s) => s === 'Completed').length;
  const draftCount = statusValues.filter((s) => s === 'Draft').length;

  if (jobsLoading) return <PageSkeleton />;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{t('availableInterviews.title')}</Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
          {augmentedJobs.length} {augmentedJobs.length === 1 ? t('availableInterviews.opportunity') : t('availableInterviews.opportunities')}
          {completedCount > 0 && t('availableInterviews.completedSuffix', { count: completedCount })}
          {draftCount > 0 && t('availableInterviews.inProgressSuffix', { count: draftCount })}
        </Typography>
      </Box>

      {jobsError && <Alert severity="error" sx={{ mb: 2 }}>{jobsError}</Alert>}

      <Box sx={{ display: 'flex', gap: 1.5, mb: hasActiveFilters ? 1.5 : 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('availableInterviews.searchPlaceholder')}
          size="small"
          sx={{ flex: '1 1 200px', maxWidth: 340 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} /></InputAdornment> }}
        />

        <FormControl size="small" sx={{ minWidth: 148 }}>
          <InputLabel>{t('availableInterviews.company')}</InputLabel>
          <Select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} label={t('availableInterviews.company')}>
            <MenuItem value="">{t('availableInterviews.allCompanies')}</MenuItem>
            {companies.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 148 }}>
          <InputLabel>{t('availableInterviews.category')}</InputLabel>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label={t('availableInterviews.category')}>
            {CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{categoryLabel(cat)}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 128 }}>
          <InputLabel>{t('availableInterviews.experience')}</InputLabel>
          <Select value={experienceFilter} onChange={(e) => setExperienceFilter(e.target.value)} label={t('availableInterviews.experience')}>
            {EXPERIENCE_LEVELS.map((lvl) => <MenuItem key={lvl} value={lvl}>{experienceLabel(lvl)}</MenuItem>)}
          </Select>
        </FormControl>

        {hasActiveFilters && (
          <Button
            variant="outlined" size="small" startIcon={<FilterAltOffIcon />} onClick={resetFilters}
            sx={{ height: 40, whiteSpace: 'nowrap', transition: 'all 160ms ease' }}
          >
            {t('availableInterviews.reset')}
          </Button>
        )}
      </Box>

      {hasActiveFilters && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {filtered.length === 0 ? t('availableInterviews.noResults') : `${filtered.length} ${filtered.length === 1 ? t('availableInterviews.result') : t('availableInterviews.results')}`}
        </Typography>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={t('availableInterviews.noInterviewsFound')}
          description={hasActiveFilters ? t('availableInterviews.noInterviewsMatch') : t('availableInterviews.noInterviewsYet')}
          icon={WorkIcon}
          action={hasActiveFilters ? <Button variant="contained" startIcon={<FilterAltOffIcon />} onClick={resetFilters} sx={{ mt: 1 }}>{t('availableInterviews.resetFilters')}</Button> : null}
        />
      ) : (
        <Grid container spacing={3.2} data-tour="available-interviews-list">
          {filtered.map((job) => (
            <Grid item xs={12} sm={6} lg={4} key={job.id}>
              <InterviewCard
                job={job}
                company={job._company}
                category={job._category}
                experience={job._experience}
                sessionStatus={jobSessionStatus.get(job.id) ?? null}
                onStart={handleStart}
                onResume={handleResume}
                t={t}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
