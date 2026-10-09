import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Tooltip, Typography, Divider, IconButton, Avatar,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WorkIcon from '@mui/icons-material/Work';
import PeopleIcon from '@mui/icons-material/People';
import BarChartIcon from '@mui/icons-material/BarChart';
import SettingsIcon from '@mui/icons-material/Settings';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import AssignmentIcon from '@mui/icons-material/Assignment';
import SummarizeIcon from '@mui/icons-material/Summarize';
import PersonIcon from '@mui/icons-material/Person';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { getInitials } from '../../utils/formatters';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import DescriptionIcon from '@mui/icons-material/Description';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import BusinessIcon from '@mui/icons-material/Business';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import HistoryIcon from '@mui/icons-material/History';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import { useTranslation } from '../../i18n';

const SIDEBAR_W = 280;
const COLLAPSED_W = 72;

// Nav items reference translation keys (not literal labels) so the sidebar
// re-renders with the right language instantly on switch — the labelKey is
// resolved with t() inside the component, not here at module load time.
const RECRUITER_NAV = [
  { labelKey: 'nav.dashboard', icon: DashboardIcon, path: ROUTES.RECRUITER_DASHBOARD, tourId: 'nav-dashboard' },
  { labelKey: 'nav.jobs', icon: WorkIcon, path: ROUTES.RECRUITER_JOBS, tourId: 'nav-jobs' },
  { labelKey: 'nav.candidates', icon: PeopleIcon, path: ROUTES.RECRUITER_CANDIDATES, tourId: 'nav-candidates' },
  {
    labelKey: 'nav.applications',
    icon: DescriptionIcon,
    path: ROUTES.RECRUITER_APPLICATIONS,
    tourId: 'nav-applications',
  },
  { labelKey: 'nav.interviews', icon: ListAltIcon, path: ROUTES.RECRUITER_INTERVIEWS, tourId: 'nav-interviews' },
  { labelKey: 'nav.aiCompare', icon: CompareArrowsIcon, path: ROUTES.RECRUITER_AI_COMPARE, tourId: 'nav-ai-compare' },
  { labelKey: 'nav.analytics', icon: BarChartIcon, path: ROUTES.RECRUITER_ANALYTICS, tourId: 'nav-analytics' },
  { labelKey: 'nav.notifications', icon: NotificationsIcon, path: ROUTES.RECRUITER_NOTIFICATIONS, tourId: 'nav-notifications' },
  { labelKey: 'nav.profile', icon: PersonIcon, path: ROUTES.RECRUITER_PROFILE, tourId: 'nav-profile' },
  { labelKey: 'nav.settings', icon: SettingsIcon, path: ROUTES.RECRUITER_SETTINGS, tourId: 'nav-settings' },
];

const SUPERADMIN_NAV = [
  { labelKey: 'superAdmin.nav.overview', icon: DashboardIcon, path: ROUTES.SUPERADMIN_DASHBOARD, tourId: 'nav-superadmin-overview' },
  { labelKey: 'superAdmin.nav.users', icon: PeopleIcon, path: '/superadmin/users', tourId: 'nav-superadmin-users' },
  { labelKey: 'superAdmin.nav.companies', icon: BusinessIcon, path: '/superadmin/companies', tourId: 'nav-superadmin-companies' },
  { labelKey: 'superAdmin.nav.billing', icon: WorkspacePremiumRoundedIcon, path: '/superadmin/billing', tourId: 'nav-superadmin-billing' },
  { labelKey: 'superAdmin.nav.activity', icon: HistoryIcon, path: '/superadmin/activity', tourId: 'nav-superadmin-activity' },
  { labelKey: 'superAdmin.nav.system', icon: HealthAndSafetyRoundedIcon, path: '/superadmin/system', tourId: 'nav-superadmin-system' },
];

const CANDIDATE_NAV = [
  { labelKey: 'nav.dashboard', icon: DashboardIcon, path: ROUTES.CANDIDATE_DASHBOARD, tourId: 'nav-dashboard' },
  { labelKey: 'nav.interviews', icon: VideoCallIcon, path: ROUTES.CANDIDATE_INTERVIEWS, tourId: 'nav-interviews' },
  { labelKey: 'nav.results', icon: AssignmentIcon, path: ROUTES.CANDIDATE_RESULTS, tourId: 'nav-results' },
  { labelKey: 'nav.reports', icon: SummarizeIcon, path: ROUTES.CANDIDATE_REPORTS, tourId: 'nav-reports' },
  { labelKey: 'nav.notifications', icon: NotificationsIcon, path: ROUTES.CANDIDATE_NOTIFICATIONS, tourId: 'nav-notifications' },
  { labelKey: 'nav.profile', icon: PersonIcon, path: ROUTES.CANDIDATE_PROFILE, tourId: 'nav-profile' },
  { labelKey: 'nav.settings', icon: SettingsIcon, path: ROUTES.CANDIDATE_SETTINGS, tourId: 'nav-settings' },
];

function WaveDecor() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, height: 18 }}>
      {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((h, i) => (
        <Box
          key={i}
          sx={{
            width: 3, height: `${h * 100}%`,
            bgcolor: 'rgba(234,118,0,0.85)',
            borderRadius: 1,
            animation: `waveBar ${0.55 + i * 0.08}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.07}s`,
          }}
        />
      ))}
    </Box>
  );
}

function NavItem({ item, collapsed, active }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const Icon = item.icon;
  const label = item.label ?? t(item.labelKey);

  const btn = (
    <motion.div
      whileHover={{ x: active ? 0 : 4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <ListItemButton
        data-tour={item.tourId}
        onClick={() => navigate(item.path)}
        sx={{
          borderRadius: 3,
          mx: 1,
          px: 1.6,
          py: 1.5,
          minHeight: 54,
          justifyContent: collapsed ? 'center' : 'flex-start',
          color: active ? 'text.primary' : 'text.secondary',
          bgcolor: active ? 'rgba(234,118,0,0.25)' : 'transparent',
          position: 'relative',
          '&::before': active ? {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '15%',
            bottom: '15%',
            width: 4,
            borderRadius: 4,
            background: 'linear-gradient(180deg, #ffad48, #f27c00)',
            boxShadow: '0 0 12px rgba(234,118,0,0.5)',
          } : undefined,
          '&:hover': {
            bgcolor: active ? 'rgba(234,118,0,0.25)' : 'rgba(255,255,255,0.08)',
            color: 'text.primary',
          },
          transition: 'all 200ms ease',
        }}
      >
        <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40, color: 'inherit', justifyContent: 'center' }}>
          <Icon sx={{ fontSize: 22 }} />
        </ListItemIcon>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <ListItemText
                primary={label}
                primaryTypographyProps={{ 
                  fontSize: '0.9rem', 
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '-0.01em'
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </ListItemButton>
    </motion.div>
  );

  return (
    <ListItem disablePadding sx={{ mb: 0.8 }}>
      {collapsed ? <Tooltip title={label} placement="right">{btn}</Tooltip> : btn}
    </ListItem>
  );
}

export default function Sidebar({ open, onClose, variant = 'permanent' }) {
  const { user, logout, isRecruiter, isSuperAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(collapsed)); }
    catch { }
  }, [collapsed]);

  const navItems = isSuperAdmin ? SUPERADMIN_NAV : isRecruiter ? RECRUITER_NAV : CANDIDATE_NAV;
  const width = collapsed ? COLLAPSED_W : SIDEBAR_W;

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const isActive = (path) => {
    const base = path.split('?')[0];
    if (isSuperAdmin && path.includes('?tab=')) {
      const tab = new URLSearchParams(path.split('?')[1]).get('tab');
      return location.pathname === base && new URLSearchParams(location.search).get('tab') === tab;
    }
    return location.pathname === base || location.pathname.startsWith(base + '/');
  };

  const inner = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', background: (t) => t.palette.mode === 'dark' ? 'linear-gradient(180deg,#0b0d12 0%,#0d1016 48%,#090b0f 100%)' : 'linear-gradient(180deg,#fbf8f2 0%,#f3efe8 48%,#f8f4ed 100%)', width, transition: 'width 300ms ease', overflow: 'hidden', borderRight: '1px solid', borderColor: 'divider', position: 'relative', '&::before': { content: '""', position: 'absolute', width: 220, height: 220, right: -90, top: 90, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,108,255,.15), transparent 70%)', filter: 'blur(8px)', pointerEvents: 'none' }, '&::after': { content: '""', position: 'absolute', width: 180, height: 180, left: -100, bottom: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,124,0,.10), transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' } }}>

      {/* Brand */}
      <Box sx={{ position: 'relative', zIndex: 1, px: 2.25, py: 3.5, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box>
              <Typography sx={{ color: 'text.primary', fontFamily: '"Poppins",sans-serif', fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                Silent<Box component="span" sx={{ color: 'primary.main' }}>Interview</Box>
              </Typography>
              <WaveDecor />
            </Box>
          </motion.div>
        )}
        {collapsed && (
          <Typography sx={{ color: 'primary.main', fontFamily: '"Poppins"', fontWeight: 700, fontSize: '1.25rem' }}>SI</Typography>
        )}
        <IconButton 
          size="small" 
          onClick={() => setCollapsed(c => !c)}
          sx={{ 
            color: 'text.secondary', 
            '&:hover': { 
              color: 'text.primary', 
              bgcolor: 'rgba(255,255,255,0.1)',
              transform: 'scale(1.1)'
            },
            transition: 'all 200ms ease'
          }}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Role badge */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={{ mx: 2, mb: 2.5, px: 2.1, py: 1.2, bgcolor: 'rgba(242,124,0,0.09)', borderRadius: 3, border: '1px solid rgba(242,124,0,0.24)' }}>
              <Typography sx={{ color: 'primary.main', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {isSuperAdmin ? `🛡️ ${t('nav.superAdmin')}` : isRecruiter ? `⚡ ${t('nav.recruiterHub')}` : `🎯 ${t('nav.candidatePortal')}`}
              </Typography>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <Box data-tour="sidebar-nav" sx={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <List dense disablePadding>
          {navItems.map(item => (
            <NavItem key={item.path} item={item} collapsed={collapsed} active={isActive(item.path)} />
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mx: 2 }} />

      {/* Profile footer */}
      <Box sx={{ position: 'relative', zIndex: 1, p: 2 }}>
        <AnimatePresence>
          {!collapsed ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 3, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 600 }}>
                  {getInitials(user?.name)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: 'text.primary', fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.2 }} noWrap>{user?.name}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }} noWrap>{user?.email}</Typography>
                </Box>
                <IconButton 
                  size="small" 
                  onClick={handleLogout}
                  sx={{ 
                    color: 'text.secondary', 
                    '&:hover': { 
                      color: '#f87171',
                      bgcolor: 'rgba(239,68,68,0.1)'
                    }
                  }}
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Box>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
            >
              <Tooltip title={t('nav.signOut')} placement="right">
                <IconButton 
                  size="small"
                  onClick={handleLogout}
                  sx={{ 
                    width: 40,
                    height: 40,
                    color: 'text.secondary',
                    '&:hover': { 
                      color: '#f87171',
                      bgcolor: 'rgba(239,68,68,0.1)'
                    }
                  }}
                >
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );

  if (variant === 'temporary') {
    return (
      <Drawer 
        open={open} 
        onClose={onClose} 
        variant="temporary"
        PaperComponent={motion.div}
        PaperProps={{
          initial: { x: -300 },
          animate: { x: 0 },
          exit: { x: -300 },
          transition: { duration: 0.3, ease: 'easeOut' },
        }}
        sx={{ '& .MuiDrawer-paper': { border: 'none', width: SIDEBAR_W } }}>
        {inner}
      </Drawer>
    );
  }

  return (
    <Drawer variant="permanent"
      sx={{
        width, flexShrink: 0, transition: 'width 300ms ease',
        '& .MuiDrawer-paper': { width, border: 'none', overflow: 'hidden', transition: 'width 300ms ease' }
      }}>
      {inner}
    </Drawer>
  );
}
