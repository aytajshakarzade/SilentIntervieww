import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider, IconButton,
  InputAdornment, MenuItem, Select, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import VideoCallRoundedIcon from '@mui/icons-material/VideoCallRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip as ChartTooltip, XAxis } from 'recharts';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/adminApi';
import { useAuth } from '../../hooks/useAuth';
import { PremiumCard } from '../../components/design';
import { useTranslation } from '../../i18n';
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans';

const ROLE_META = { SUPERADMIN: { tone: 'error' }, RECRUITER: { tone: 'warning' }, CANDIDATE: { tone: 'info' } };

const PLAN_META = {
  Free: { color: 'default' },
  Go: { color: 'warning' },
  Pro: { color: 'secondary' },
};

const localeFor = (language) => language === 'az' ? 'az-AZ' : language === 'ru' ? 'ru-RU' : 'en-US';
const fmt = (n, language = 'en') => new Intl.NumberFormat(localeFor(language)).format(Number(n || 0));
const money = (n, language = 'en') => new Intl.NumberFormat(localeFor(language), { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const date = (v, language = 'en') => v ? new Date(v).toLocaleDateString(localeFor(language), { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}

function StatCard({ icon: Icon, label, value, note, accent = 'primary.main', trend }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: .2 }}>
      <PremiumCard sx={{ p: 2.2, height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in srgb, ${accent} 20%, transparent), transparent 68%)` }} />
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.12)', color: accent }}><Icon /></Box>
          {trend && <Chip size="small" icon={<TrendingUpRoundedIcon />} label={trend} color="success" variant="outlined" />}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>{label}</Typography>
        <Typography variant="h4" fontWeight={950} sx={{ letterSpacing: '-.04em' }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{note}</Typography>
      </PremiumCard>
    </motion.div>
  );
}

function HealthPill({ label, value, good = true }) {
  return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.2, borderRadius: 2.5, bgcolor: good ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)', border: '1px solid', borderColor: good ? 'rgba(34,197,94,.16)' : 'rgba(239,68,68,.16)' }}>
    <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: good ? 'success.main' : 'error.main', boxShadow: good ? '0 0 0 4px rgba(34,197,94,.10)' : '0 0 0 4px rgba(239,68,68,.10)' }} /><Typography variant="body2" fontWeight={700}>{label}</Typography></Stack>
    <Typography variant="caption" color="text.secondary">{value}</Typography>
  </Box>;
}

function MiniBars({ plans }) { const { t, language } = useTranslation();
  const total = Math.max(1, (plans?.free || 0) + (plans?.go || 0) + (plans?.pro || 0));
  return <Box>
    <Stack direction="row" spacing={1} sx={{ height: 9, borderRadius: 99, overflow: 'hidden', bgcolor: 'action.hover' }}>
      <Box sx={{ width: `${(plans?.free || 0) / total * 100}%`, bgcolor: 'text.disabled' }} />
      <Box sx={{ width: `${(plans?.go || 0) / total * 100}%`, bgcolor: 'warning.main' }} />
      <Box sx={{ width: `${(plans?.pro || 0) / total * 100}%`, bgcolor: 'secondary.main' }} />
    </Stack>
    <Stack direction="row" spacing={2} sx={{ mt: 1.3, flexWrap: 'wrap' }}>
      <Typography variant="caption">Free <b>{fmt(plans?.free, language)}</b></Typography>
      <Typography variant="caption">Go <b>{fmt(plans?.go, language)}</b></Typography>
      <Typography variant="caption">Pro <b>{fmt(plans?.pro, language)}</b></Typography>
    </Stack>
  </Box>;
}

export default function SuperAdminDashboard({ section = 'overview' }) {
  const { user } = useAuth();
  const { language, t } = useTranslation();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activity, setActivity] = useState([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [tab, setTab] = useState(section || 'overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [o, m, u, c, a] = await Promise.all([
        adminApi.overview(), adminApi.dashboard(),
        adminApi.users({ search: search || undefined, includeDeleted }),
        adminApi.companies({ search: companySearch || undefined }),
        adminApi.activity(18),
      ]);
      setOverview(o || null); setMetrics(m || null);
      setUsers(Array.isArray(u) ? u : []); setCompanies(Array.isArray(c) ? c : []); setActivity(Array.isArray(a) ? a : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || t('superAdminDashboard.loadFailed'));
    } finally { setLoading(false); }
  }, [search, includeDeleted, companySearch]);

  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [load]);

  const action = async (key, fn, success) => {
    setBusy(key);
    try { await fn(); toast.success(success); await load(); }
    catch (err) { toast.error(err?.response?.data?.message || t('superAdminDashboard.operationFailed')); }
    finally { setBusy(''); }
  };

  const filteredUsers = useMemo(() => users.filter(item => {
    const roleOk = role === 'all' || item.role === role;
    const planOk = plan === 'all' || (item.plan || 'Free') === plan;
    const statusValue = item.isDeleted ? 'removed' : item.isActive ? 'active' : 'suspended';
    const statusOk = status === 'all' || statusValue === status;
    return roleOk && planOk && statusOk;
  }), [users, role, plan, status]);

  const chartData = useMemo(() => {
    const total = Number(metrics?.users || overview?.users || 0);
    const active = Number(metrics?.activeUsers || overview?.activeUsers || 0);
    const month = Number(metrics?.newUsersThisMonth || 0);
    return [
      { name: t('superAdminDashboard.overviewCardUsers'), value: Math.max(0, total - month * 2) },
      { name: t('superAdminDashboard.platformActivity'), value: Math.max(0, total - month) },
      { name: t('superAdminDashboard.active'), value: active },
      { name: t('superAdminDashboard.newUsersMonth'), value: Math.max(0, month) },
    ];
  }, [metrics, overview, t]);

  const exportUsers = () => {
    const rows = [[t('superAdminDashboard.user'), t('superAdminDashboard.email'), t('superAdminDashboard.role'), t('superAdminDashboard.plan'), t('superAdminDashboard.status'), t('superAdminDashboard.company'), t('superAdminDashboard.created')]];
    filteredUsers.forEach(x => rows.push([x.name, x.email, x.role, x.plan || 'Free', x.isDeleted ? t('superAdminDashboard.removed') : x.isActive ? t('superAdminDashboard.active') : t('superAdminDashboard.suspended'), x.companyName || '', x.createdAt || '']));
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'silentinterview-users.csv'; a.click(); URL.revokeObjectURL(url);
    toast.success(t('superAdminDashboard.userListExported'));
  };

  useEffect(() => { setTab(section || 'overview'); }, [section]);

  const handleTabChange = (_, value) => {
    const paths = { overview: '/superadmin/dashboard', users: '/superadmin/users', companies: '/superadmin/companies', billing: '/superadmin/billing', activity: '/superadmin/activity', system: '/superadmin/system' };
    navigate(paths[value] || paths.overview);
  };

  const sa = (key) => t(`superAdmin.nav.${key}`);
  const sectionTitle = sa(tab);
  const sectionSubtitles = {
    overview: t('superAdminDashboard.pageSubtitle'),
    users: t('superAdminDashboard.usersSubtitle'),
    companies: t('superAdminDashboard.companiesSubtitle'),
    billing: t('superAdminDashboard.billingSubtitle'),
    activity: t('superAdminDashboard.activitySubtitle'),
    system: t('superAdminDashboard.systemSubtitle'),
  };
  const sectionSubtitle = sectionSubtitles[tab] || sectionSubtitles.overview;
  const currentId = user?.id;
  const mrr = metrics?.mrr ?? 0;

  return (
    <Box className="si-premium-admin-shell page-enter" sx={{ pb: 7 }}>
      {tab === 'overview' ? (
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={2.5} sx={{ mb: 3.2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .8 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2.8, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.14)', color: 'primary.main', boxShadow: '0 10px 30px rgba(234,118,0,.10)' }}><ShieldRoundedIcon fontSize="small" /></Box>
              <Typography variant="overline" color="primary.main">{t('superAdminDashboard.platformControl')}</Typography>
            </Stack>
            <Typography variant="h3" fontWeight={900} sx={{ letterSpacing: '-.045em' }}>{t('superAdmin.portal')}</Typography>
            <Typography color="text.secondary" sx={{ mt: .55, maxWidth: 680 }}>{sectionSubtitle}</Typography>
          </Box>
          <Stack direction="row" spacing={1}><Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={exportUsers}>{t('superAdminDashboard.export')}</Button><Button variant="contained" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>{t('superAdminDashboard.refresh')}</Button></Stack>
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-end' }} spacing={2} sx={{ mb: 3.2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: .7 }}><Box sx={{ width: 34, height: 34, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.13)', color: 'primary.main' }}><ShieldRoundedIcon fontSize="small" /></Box><Typography variant="overline" color="primary.main">{t('superAdmin.nav.overview')} · SuperAdmin</Typography></Stack>
            <Typography variant="h4" fontWeight={950} sx={{ letterSpacing: '-.045em' }}>{sectionTitle}</Typography>
            <Typography color="text.secondary" sx={{ mt: .4 }}>{sectionSubtitle}</Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} disabled={loading}>{t('superAdminDashboard.refresh')}</Button>
        </Stack>
      )}

      {error && <Alert severity="error" sx={{ mb: 2.5, borderRadius: 3 }}>{error}</Alert>}

      {tab === 'overview' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
          <StatCard icon={PeopleAltRoundedIcon} label={t('superAdminDashboard.overviewCardUsers')} value={fmt(overview?.users, language)} note={`${fmt(overview?.activeUsers, language)} ${t('superAdminDashboard.activeAccounts')}`} trend={overview?.users ? t('superAdminDashboard.live') : undefined} />
          <StatCard icon={BusinessRoundedIcon} label={t('superAdminDashboard.companies')} value={fmt(overview?.companies)} note={t('superAdminDashboard.registeredWorkspaces')} accent="info.main" />
          <StatCard icon={WorkspacePremiumRoundedIcon} label={t('superAdminDashboard.estimatedMrr')} value={money(mrr, language)} note={t('superAdminDashboard.mrrNote')} accent="success.main" />
          <StatCard icon={SecurityRoundedIcon} label={t('superAdminDashboard.superAdmins')} value={fmt(overview?.superAdmins)} note={t('superAdminDashboard.protectedAdmins')} accent="error.main" />
        </Box>
      )}

      {loading && !overview ? <Box sx={{ minHeight: 420, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : (
        <Box sx={{ pb: 3 }}>
          {tab === 'overview' && <Overview metrics={metrics} overview={overview} chartData={chartData} activity={activity} onBilling={() => handleTabChange(null, 'billing')} />}
          {tab === 'users' && <UsersPanel users={filteredUsers} search={search} setSearch={setSearch} role={role} setRole={setRole} plan={plan} setPlan={setPlan} status={status} setStatus={setStatus} includeDeleted={includeDeleted} setIncludeDeleted={setIncludeDeleted} currentId={currentId} busy={busy} action={action} />}
          {tab === 'companies' && <CompaniesPanel companies={companies} search={companySearch} setSearch={setCompanySearch} />}
          {tab === 'billing' && <BillingPanel metrics={metrics} overview={overview} users={users} />}
          {tab === 'activity' && <ActivityPanel activity={activity} />}
          {tab === 'system' && <SystemPanel metrics={metrics} />}
        </Box>
      )}
    </Box>
  );
}

function Overview({ metrics, overview, chartData, activity, onBilling }) {
  const { language, t } = useTranslation();
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1.55fr .8fr' }, gap: 2 }}>
    <PremiumCard sx={{ p: 2.2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.platformActivity')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.platformActivityBody')}</Typography></Box>
        <Chip label={t('superAdminDashboard.live')} color="success" size="small" variant="outlined" />
      </Stack>
      <Box sx={{ height: 230 }}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="adminFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EA7600" stopOpacity={.32} /><stop offset="100%" stopColor="#EA7600" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="name" axisLine={false} tickLine={false} /><ChartTooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(255,255,255,.1)' }} /><Area type="monotone" dataKey="value" stroke="#EA7600" strokeWidth={3} fill="url(#adminFill)" /></AreaChart></ResponsiveContainer></Box>
      <Divider sx={{ my: 1.5 }} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1 }}>
        <MiniMetric icon={WorkOutlineRoundedIcon} label={t('superAdminDashboard.jobs')} value={metrics?.jobs} language={language} />
        <MiniMetric icon={PeopleAltRoundedIcon} label={t('superAdminDashboard.applications')} value={metrics?.applications} language={language} />
        <MiniMetric icon={VideoCallRoundedIcon} label={t('superAdminDashboard.interviews')} value={metrics?.interviews} language={language} />
        <MiniMetric icon={AssignmentTurnedInRoundedIcon} label={t('superAdminDashboard.reports')} value={metrics?.reports} language={language} />
      </Box>
    </PremiumCard>

    <PremiumCard sx={{ p: 2.2 }}>
      <Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.planMix')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('superAdminDashboard.planMixBody')}</Typography>
      <MiniBars plans={metrics?.plans || { free: overview?.free, go: overview?.go, pro: overview?.pro }} />
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.2}>
        <MiniLine label={t('superAdminDashboard.aiConversations')} value={fmt(metrics?.aiConversations, language)} icon={<SmartToyRoundedIcon />} />
        <MiniLine label={t('superAdminDashboard.subscriptionEvents')} value={fmt(metrics?.subscriptionEvents, language)} icon={<EventNoteRoundedIcon />} />
        <MiniLine label={t('superAdminDashboard.newUsersMonth')} value={fmt(metrics?.newUsersThisMonth, language)} icon={<PeopleAltRoundedIcon />} />
      </Stack>
      <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={onBilling}>{t('superAdminDashboard.reviewBilling')}</Button>
    </PremiumCard>

    <PremiumCard sx={{ p: 2.2, gridColumn: { xl: '1 / -1' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.recentActivity')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.recentActivityBody')}</Typography></Box><Chip label={`${fmt(activity.length, language)} ${t('superAdminDashboard.recentCount')}`} size="small" variant="outlined" /></Stack>
      <ActivityRows activity={activity.slice(0, 6)} />
    </PremiumCard>
  </Box>;
}

function MiniMetric({ icon: Icon, label, value, language = 'en' }) { return <Box sx={{ p: 1.2, borderRadius: 2.5, bgcolor: 'action.hover' }}><Stack direction="row" spacing={1} alignItems="center"><Icon sx={{ fontSize: 18, color: 'primary.main' }} /><Box><Typography variant="caption" color="text.secondary">{label}</Typography><Typography fontWeight={900}>{fmt(value, language)}</Typography></Box></Stack></Box>; }
function MiniLine({ label, value, icon }) { return <Stack direction="row" justifyContent="space-between" alignItems="center"><Stack direction="row" spacing={1} alignItems="center"><Box sx={{ width: 30, height: 30, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover' }}>{icon}</Box><Typography variant="body2" fontWeight={700}>{label}</Typography></Stack><Typography fontWeight={900}>{value}</Typography></Stack>; }

function UsersPanel({ users, search, setSearch, role, setRole, plan, setPlan, status, setStatus, includeDeleted, setIncludeDeleted, currentId, busy, action }) {
  const { language, t } = useTranslation();
  return <Box>
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} alignItems={{ lg: 'center' }} sx={{ mb: 2 }}>
      <Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.userManagement')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.userManagementBody')}</Typography></Box>
      <TextField size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('superAdminDashboard.searchNameEmail')} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} sx={{ minWidth: { lg: 250 } }} />
      <Select size="small" value={role} onChange={e => setRole(e.target.value)}><MenuItem value="all">{t('superAdminDashboard.allRoles')}</MenuItem><MenuItem value="RECRUITER">{t('superAdminDashboard.recruiters')}</MenuItem><MenuItem value="CANDIDATE">{t('superAdminDashboard.candidates')}</MenuItem><MenuItem value="SUPERADMIN">{t('superAdminDashboard.superAdminRole')}</MenuItem></Select>
      <Select size="small" value={plan} onChange={e => setPlan(e.target.value)}><MenuItem value="all">{t('superAdminDashboard.allPlans')}</MenuItem><MenuItem value="Free">Free</MenuItem><MenuItem value="Go">Go</MenuItem><MenuItem value="Pro">Pro</MenuItem></Select>
      <Select size="small" value={status} onChange={e => setStatus(e.target.value)}><MenuItem value="all">{t('superAdminDashboard.allStatus')}</MenuItem><MenuItem value="active">{t('superAdminDashboard.active')}</MenuItem><MenuItem value="suspended">{t('superAdminDashboard.suspended')}</MenuItem><MenuItem value="removed">{t('superAdminDashboard.removed')}</MenuItem></Select>
      <Button size="small" variant={includeDeleted ? 'contained' : 'outlined'} onClick={() => setIncludeDeleted(v => !v)}>{includeDeleted ? t('superAdminDashboard.removedShown') : t('superAdminDashboard.showRemoved')}</Button>
    </Stack>
    <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(250px,1.5fr) 130px 130px minmax(130px, .8fr) 140px auto', gap: 1.5, px: 1.5, py: 1, color: 'text.secondary', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}><span>{t('superAdminDashboard.user')}</span><span>{t('superAdminDashboard.role')}</span><span>{t('superAdminDashboard.plan')}</span><span>{t('superAdminDashboard.company')}</span><span>{t('superAdminDashboard.status')}</span><span /></Box>
    <Stack spacing={1}>
      {users.length === 0 ? <Box sx={{ py: 9, textAlign: 'center' }}><PeopleAltRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} /><Typography fontWeight={800} sx={{ mt: 1 }}>{t('superAdminDashboard.noUsers')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.changeFilters')}</Typography></Box> : users.map(item => {
        const meta = ROLE_META[item.role] || { tone: 'default' }; const roleLabel = item.role === 'SUPERADMIN' ? t('superAdminDashboard.roleSuperAdmin') : item.role === 'RECRUITER' ? t('superAdminDashboard.roleRecruiter') : item.role === 'CANDIDATE' ? t('superAdminDashboard.roleCandidate') : item.role; const isSelf = item.id === currentId; const k = item.id;
        return <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(250px,1.5fr) 130px 130px minmax(130px,.8fr) 140px auto' }, gap: 1.5, alignItems: 'center', p: 1.35, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: item.isDeleted ? 'rgba(239,68,68,.04)' : 'transparent', '&:hover': { bgcolor: 'action.hover' } }}>
          <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}><Avatar sx={{ width: 40, height: 40, bgcolor: item.role === 'SUPERADMIN' ? 'error.main' : 'primary.main', fontWeight: 900 }}>{initials(item.name)}</Avatar><Box minWidth={0}><Typography fontWeight={800} noWrap>{item.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{item.email}</Typography><Typography variant="caption" color="text.disabled" display="block">{t('superAdminDashboard.joined')} {date(item.createdAt, language)}</Typography></Box></Stack>
          <Chip size="small" label={roleLabel} color={meta.tone} variant="outlined" sx={{ width: 'fit-content' }} />
          <Select size="small" value={item.plan || 'Free'} disabled={Boolean(item.isDeleted) || busy === `plan:${k}`} onChange={e => action(`plan:${k}`, () => adminApi.setPlan(k, e.target.value), t('superAdminDashboard.planUpdated'))}><MenuItem value="Free">Free</MenuItem><MenuItem value="Go">Go</MenuItem><MenuItem value="Pro">Pro</MenuItem></Select>
          <Typography variant="body2" color={item.companyName ? 'text.primary' : 'text.disabled'} noWrap>{item.companyName || t('superAdminDashboard.personalAccount')}</Typography>
          <Stack direction="row" spacing={.6} alignItems="center"><Chip size="small" icon={item.isDeleted ? <DeleteOutlineRoundedIcon /> : item.isActive ? <CheckCircleRoundedIcon /> : <BlockRoundedIcon />} label={item.isDeleted ? t('superAdminDashboard.removed') : item.isActive ? t('superAdminDashboard.active') : t('superAdminDashboard.suspended')} color={item.isDeleted ? 'error' : item.isActive ? 'success' : 'warning'} variant="outlined" /></Stack>
          <Stack direction="row" justifyContent="flex-end">
            {item.isDeleted ? <Tooltip title={t('superAdminDashboard.restore')}><span><IconButton disabled={busy === `restore:${k}`} onClick={() => action(`restore:${k}`, () => adminApi.restoreUser(k), t('superAdminDashboard.userRestored'))}><RestoreRoundedIcon /></IconButton></span></Tooltip> : <><Tooltip title={isSelf ? t('superAdminDashboard.youCannotSuspend') : item.isActive ? t('superAdminDashboard.suspendUser') : t('superAdminDashboard.activateUser')}><span><IconButton disabled={isSelf || busy === `status:${k}`} onClick={() => action(`status:${k}`, () => adminApi.setStatus(k, !item.isActive), item.isActive ? t('superAdminDashboard.userSuspended') : t('superAdminDashboard.userActivated'))} color={item.isActive ? 'warning' : 'success'}>{item.isActive ? <BlockRoundedIcon /> : <CheckCircleRoundedIcon />}</IconButton></span></Tooltip><Tooltip title={isSelf ? t('superAdminDashboard.youCannotRemove') : t('superAdminDashboard.removeUser')}><span><IconButton disabled={isSelf || busy === `delete:${k}`} onClick={() => { if (window.confirm(t('superAdminDashboard.removeConfirm', { name: item.name }))) action(`delete:${k}`, () => adminApi.removeUser(k), t('superAdminDashboard.userRemoved')); }} color="error"><DeleteOutlineRoundedIcon /></IconButton></span></Tooltip></>}
          </Stack>
        </Box>;
      })}
    </Stack>
  </Box>;
}

function CompaniesPanel({ companies, search, setSearch }) {
  const { language, t } = useTranslation();
  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}><Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.companyDirectory')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.companyDirectoryBody')}</Typography></Box><TextField size="small" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('superAdminDashboard.searchCompanyIndustry')} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} sx={{ width: { md: 300 } }} /></Stack>
    <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 760 }}><Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr .7fr .7fr', gap: 2, px: 1.5, py: 1, color: 'text.secondary', fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase' }}><span>{t('superAdminDashboard.company')}</span><span>{t('superAdminDashboard.industry')}</span><span>{t('superAdminDashboard.website')}</span><span>{t('superAdminDashboard.recruiters')}</span><span>{t('superAdminDashboard.jobs')}</span></Box><Stack spacing={1}>{companies.map(c => <Box key={c.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr .7fr .7fr', gap: 2, alignItems: 'center', p: 1.35, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" spacing={1.2} alignItems="center"><Avatar src={c.logoUrl || undefined} sx={{ width: 40, height: 40, bgcolor: 'rgba(234,118,0,.12)', color: 'primary.main', fontWeight: 900 }}>{initials(c.name)}</Avatar><Box minWidth={0}><Typography fontWeight={800} noWrap>{c.name}</Typography><Typography variant="caption" color="text.secondary">{t('superAdminDashboard.created')} {date(c.createdAt, language)}</Typography></Box></Stack><Typography variant="body2">{c.industry || '—'}</Typography><Typography variant="body2" noWrap color={c.website ? 'primary.main' : 'text.disabled'}>{c.website || '—'}</Typography><Typography fontWeight={800}>{fmt(c.recruiters)}</Typography><Typography fontWeight={800}>{fmt(c.jobs)}</Typography></Box>)}</Stack></Box></Box>
    {companies.length === 0 && <Box sx={{ py: 8, textAlign: 'center' }}><BusinessRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} /><Typography fontWeight={800}>{t('superAdminDashboard.noCompanies')}</Typography></Box>}
  </Box>;
}

function BillingPanel({ metrics, overview }) {
  const { language, t } = useTranslation();
  const { plans: catalog } = useSubscriptionPlans('recruiter');
  const plans = metrics?.plans || { free: overview?.free || 0, go: overview?.go || 0, pro: overview?.pro || 0 };
  const paid = Number(plans.go || 0) + Number(plans.pro || 0); const total = Math.max(1, Number(plans.free || 0) + paid);
  const catalogMap = Object.fromEntries((catalog || []).map((p) => [p.id, p]));
  return <Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.plansBilling')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{t('superAdminDashboard.plansBillingBody')}</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 2.5 }}>
      {['Free','Go','Pro'].map(p => {
        const catalogPlan = catalogMap[p];
        const price = Number(catalogPlan?.price ?? (p === 'Free' ? 0 : p === 'Go' ? 9.99 : 24.99));
        const count = Number(plans[p.toLowerCase()] || 0);
        const share = Math.round(count / total * 100);
        const recruiterFeatures = catalogPlan?.features || [];
        return <PremiumCard key={p} sx={{ p: 3, border: p === 'Go' ? '1px solid rgba(234,118,0,.45)' : undefined, minHeight: 245 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.5}><Box><Typography variant="overline" color={p === 'Pro' ? 'secondary.main' : 'primary.main'}>{p === 'Go' ? t('superAdminDashboard.recommended') : p === 'Pro' ? t('superAdminDashboard.premium') : t('superAdminDashboard.starter')}</Typography><Typography variant="h5" fontWeight={950}>{money(price, language)}<Typography component="span" variant="caption"> {t('superAdminDashboard.perMonth')}</Typography></Typography></Box><Chip label={t('superAdminDashboard.planUsers', { count: fmt(count, language) })} color={PLAN_META[p].color} variant="outlined" /></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.8, minHeight: 38, lineHeight: 1.6 }}>{catalogPlan?.description || '—'}</Typography>
          <Stack spacing={.7} sx={{ mt: 1.8, minHeight: 72 }}>{recruiterFeatures.slice(0, 3).map((f, i) => <Typography key={i} variant="caption" color="text.secondary">✓ {f}</Typography>)}</Stack>
          <Box sx={{ mt: 2 }}><Box sx={{ height: 8, borderRadius: 99, bgcolor: 'action.hover', overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${share}%`, bgcolor: p === 'Pro' ? 'secondary.main' : p === 'Go' ? 'warning.main' : 'text.disabled', borderRadius: 99 }} /></Box><Typography variant="caption" color="text.secondary">{t('superAdminDashboard.accountShare', { percent: share })}</Typography></Box>
        </PremiumCard>;
      })}
    </Box>
    <PremiumCard sx={{ p: 3, mt: 3 }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><Box><Typography fontWeight={900}>{t('superAdminDashboard.revenueSnapshot')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.revenueSnapshotBody')}</Typography></Box><Typography variant="h5" fontWeight={950}>{money(metrics?.mrr, language)}</Typography></Stack><Divider sx={{ my: 2.5 }} /><Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 2, md: 4 }}><MiniLine label={t('superAdminDashboard.paidAccounts')} value={fmt(paid, language)} icon={<WorkspacePremiumRoundedIcon />} /><MiniLine label={t('superAdminDashboard.conversionPaid')} value={`${Math.round(paid / total * 100)}%`} icon={<TrendingUpRoundedIcon />} /><MiniLine label={t('superAdminDashboard.subscriptionEvents')} value={fmt(metrics?.subscriptionEvents, language)} icon={<EventNoteRoundedIcon />} /></Stack></PremiumCard>
  </Box>;
}

function ActivityPanel({ activity }) { const { language, t } = useTranslation(); return <Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.auditActivity')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('superAdminDashboard.auditBody')}</Typography><ActivityRows activity={activity} />{activity.length === 0 && <Box sx={{ py: 7, textAlign: 'center' }}><EventNoteRoundedIcon sx={{ fontSize: 44, color: 'text.disabled' }} /><Typography fontWeight={800}>{t('superAdminDashboard.noActivity')}</Typography></Box>}</Box>; }
function ActivityRows({ activity }) { const { language, t } = useTranslation(); return <Stack spacing={1}>{activity.map((x, i) => <Box key={x.id || i} sx={{ display: 'grid', gridTemplateColumns: '42px 1fr auto', gap: 1.2, alignItems: 'center', p: 1.1, borderRadius: 2.5, bgcolor: 'action.hover' }}><Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(234,118,0,.10)', color: 'primary.main' }}><EventNoteRoundedIcon fontSize="small" /></Box><Box minWidth={0}><Typography variant="body2" fontWeight={800}>{x.description || x.action || t('superAdminDashboard.platformActivity')}</Typography><Typography variant="caption" color="text.secondary">{x.actor || t('superAdminDashboard.actorSystem')}{x.company ? ` · ${x.company}` : ''} · {date(x.createdAt, language)}</Typography></Box><Chip size="small" label={x.entityType || t('superAdminDashboard.system')} variant="outlined" /></Box>)}</Stack>; }

function SystemPanel({ metrics }) { const { t } = useTranslation(); const health = metrics?.health || {}; return <Box><Typography variant="h6" fontWeight={900}>{t('superAdminDashboard.systemHealth')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('superAdminDashboard.operationalSignals')}</Typography><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}><PremiumCard sx={{ p: 2 }}><Stack spacing={1}><HealthPill label="API" value={health.api || t('superAdminDashboard.operational')} /><HealthPill label="Database" value={health.database || t('superAdminDashboard.connected')} /><HealthPill label={t('superAdminDashboard.aiServices')} value={health.ai || t('superAdminDashboard.notChecked')} good={Boolean(health.ai)} /><HealthPill label={t('superAdminDashboard.billing')} value={health.billing || t('superAdminDashboard.notChecked')} good={Boolean(health.billing)} /></Stack></PremiumCard><PremiumCard sx={{ p: 2 }}><Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}><Box sx={{ width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: 'rgba(34,197,94,.10)', color: 'success.main' }}><SecurityRoundedIcon /></Box><Box><Typography fontWeight={900}>{t('superAdminDashboard.securityPosture')}</Typography><Typography variant="body2" color="text.secondary">{t('superAdminDashboard.adminServerAuth')}</Typography></Box></Stack><Chip icon={<CheckCircleRoundedIcon />} label={t('superAdminDashboard.protectedEndpoints')} color="success" variant="outlined" /><Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>{t('superAdminDashboard.adminGuardNote')}</Typography></PremiumCard></Box></Box>; }
