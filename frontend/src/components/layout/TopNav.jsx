import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AppBar, Toolbar, Box, IconButton, Typography, Avatar,
  Menu, MenuItem, ListItemIcon, Badge, Tooltip, Divider,
  useMediaQuery, useTheme, ListItemText, CircularProgress, Button,
  InputBase, Dialog, DialogContent, Chip, Stack, ButtonBase,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardCommandKeyRoundedIcon from '@mui/icons-material/KeyboardCommandKeyRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import PeopleOutlineRoundedIcon from '@mui/icons-material/PeopleOutlineRounded';
import VideoCallRoundedIcon from '@mui/icons-material/VideoCallRounded';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { getInitials } from '../../utils/formatters';
import { notificationApi } from '../../api/notificationApi';
import { useTranslation } from '../../i18n';
import LanguageSwitcher from '../common/LanguageSwitcher';

const EXACT = {
  [ROUTES.RECRUITER_DASHBOARD]: 'nav.dashboard',
  [ROUTES.RECRUITER_JOBS]: 'nav.jobs',
  [ROUTES.RECRUITER_CANDIDATES]: 'nav.candidates',
  [ROUTES.RECRUITER_INTERVIEWS]: 'nav.allInterviews',
  [ROUTES.RECRUITER_ANALYTICS]: 'nav.analytics',
  [ROUTES.RECRUITER_SETTINGS]: 'nav.settings',
  [ROUTES.RECRUITER_PROFILE]: 'nav.myProfile',
  [ROUTES.RECRUITER_NOTIFICATIONS]: 'nav.notifications',
  [ROUTES.CANDIDATE_INTERVIEWS]: 'nav.availableInterviews',
  [ROUTES.CANDIDATE_RESULTS]: 'nav.results',
  [ROUTES.CANDIDATE_REPORTS]: 'nav.reports',
  [ROUTES.CANDIDATE_PROFILE]: 'nav.myProfile',
  [ROUTES.CANDIDATE_SETTINGS]: 'nav.settings',
  [ROUTES.CANDIDATE_DASHBOARD]: 'nav.dashboard',
  [ROUTES.CANDIDATE_NOTIFICATIONS]: 'nav.notifications',
  '/superadmin/dashboard': 'superAdmin.nav.overview',
  '/superadmin/users': 'superAdmin.nav.users',
  '/superadmin/companies': 'superAdmin.nav.companies',
  '/superadmin/billing': 'superAdmin.nav.billing',
  '/superadmin/activity': 'superAdmin.nav.activity',
  '/superadmin/system': 'superAdmin.nav.system',
  '/superadmin/profile': 'nav.myProfile',
  '/superadmin/settings': 'nav.settings',
};

const PREFIX = [['/candidate/interviews/', 'nav.liveInterview']];

function getTitleKey(pathname) {
  if (EXACT[pathname]) return EXACT[pathname];
  for (const [prefix, key] of PREFIX) if (pathname.startsWith(prefix)) return key;
  return 'common.appName';
}

const actionSx = {
  width: 42,
  height: 42,
  borderRadius: 2.7,
  color: 'text.secondary',
  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.72)',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.06)',
  transition: 'transform 180ms ease, color 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease',
  '&:hover': {
    color: 'text.primary',
    borderColor: 'primary.main',
    bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(242,124,0,.09)' : 'rgba(242,124,0,.08)',
    boxShadow: '0 0 0 4px rgba(242,124,0,.07), 0 12px 30px rgba(0,0,0,.10)',
    transform: 'translateY(-1px)',
  },
};

export default function TopNav({ onMenuToggle, colorMode, toggleColorMode }) {
  const { user, logout, isRecruiter, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const isTablet = useMediaQuery(muiTheme.breakpoints.down('lg'));
  const { t } = useTranslation();

  const [profileAnchor, setProfileAnchor] = useState(null);
  const [notificationAnchor, setNotificationAnchor] = useState(null);
  const [notificationFeed, setNotificationFeed] = useState({ items: [], unreadCount: 0 });
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const title = t(getTitleKey(location.pathname));
  const profilePath = isSuperAdmin ? ROUTES.SUPERADMIN_PROFILE : isRecruiter ? ROUTES.RECRUITER_PROFILE : ROUTES.CANDIDATE_PROFILE;
  const settingsPath = isSuperAdmin ? ROUTES.SUPERADMIN_SETTINGS : isRecruiter ? ROUTES.RECRUITER_SETTINGS : ROUTES.CANDIDATE_SETTINGS;
  const roleLabel = isSuperAdmin ? t('status.admin') : isRecruiter ? t('status.recruiter') : t('status.candidate');

  const searchItems = useMemo(() => {
    if (isSuperAdmin) return [
      { path: '/superadmin/dashboard', labelKey: 'superAdmin.nav.overview', icon: DashboardRoundedIcon },
      { path: '/superadmin/users', labelKey: 'superAdmin.nav.users', icon: PeopleOutlineRoundedIcon },
      { path: '/superadmin/companies', labelKey: 'superAdmin.nav.companies', icon: BusinessRoundedIcon },
      { path: '/superadmin/billing', labelKey: 'superAdmin.nav.billing', icon: CreditCardRoundedIcon },
      { path: '/superadmin/activity', labelKey: 'superAdmin.nav.activity', icon: AssessmentOutlinedIcon },
      { path: '/superadmin/system', labelKey: 'superAdmin.nav.system', icon: ShieldRoundedIcon },
      { path: ROUTES.SUPERADMIN_PROFILE, labelKey: 'nav.myProfile', icon: PersonIcon },
      { path: ROUTES.SUPERADMIN_SETTINGS, labelKey: 'nav.settings', icon: TuneRoundedIcon },
    ];
    if (isRecruiter) return [
      { path: ROUTES.RECRUITER_DASHBOARD, labelKey: 'nav.dashboard', icon: DashboardRoundedIcon },
      { path: ROUTES.RECRUITER_JOBS, labelKey: 'nav.jobs', icon: WorkOutlineRoundedIcon },
      { path: ROUTES.RECRUITER_CANDIDATES, labelKey: 'nav.candidates', icon: PeopleOutlineRoundedIcon },
      { path: ROUTES.RECRUITER_APPLICATIONS, labelKey: 'nav.applications', icon: AssessmentOutlinedIcon },
      { path: ROUTES.RECRUITER_INTERVIEWS, labelKey: 'nav.allInterviews', icon: VideoCallRoundedIcon },
      { path: ROUTES.RECRUITER_ANALYTICS, labelKey: 'nav.analytics', icon: AssessmentOutlinedIcon },
      { path: ROUTES.RECRUITER_AI_COMPARE, labelKey: 'nav.aiCompare', icon: PeopleOutlineRoundedIcon },
      { path: '/billing', labelKey: 'nav.billing', icon: CreditCardRoundedIcon },
      { path: ROUTES.RECRUITER_PROFILE, labelKey: 'nav.myProfile', icon: PersonIcon },
      { path: ROUTES.RECRUITER_SETTINGS, labelKey: 'nav.settings', icon: TuneRoundedIcon },
    ];
    return [
      { path: ROUTES.CANDIDATE_DASHBOARD, labelKey: 'nav.dashboard', icon: DashboardRoundedIcon },
      { path: ROUTES.CANDIDATE_INTERVIEWS, labelKey: 'nav.availableInterviews', icon: VideoCallRoundedIcon },
      { path: ROUTES.CANDIDATE_RESULTS, labelKey: 'nav.results', icon: AssessmentOutlinedIcon },
      { path: ROUTES.CANDIDATE_REPORTS, labelKey: 'nav.reports', icon: AssessmentOutlinedIcon },
      { path: ROUTES.CANDIDATE_PROFILE, labelKey: 'nav.myProfile', icon: PersonIcon },
      { path: ROUTES.CANDIDATE_SETTINGS, labelKey: 'nav.settings', icon: TuneRoundedIcon },
    ];
  }, [isSuperAdmin, isRecruiter, t]);

  const filteredSearchItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return searchItems;
    return searchItems.filter((item) => `${t(item.labelKey)} ${item.path}`.toLowerCase().includes(query));
  }, [search, searchItems, t]);

  const loadNotifications = async () => {
    if (!user?.id) return;
    setNotificationsLoading(true);
    try {
      const feed = await notificationApi.getMine();
      setNotificationFeed(feed || { items: [], unreadCount: 0 });
    } catch {
      setNotificationFeed((current) => current);
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => { loadNotifications(); }, [user?.id]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setSearchOpen(true);
      }
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault(); setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false); setProfileAnchor(null); setNotificationAnchor(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      setNotificationFeed((feed) => ({
        unreadCount: Math.max(0, feed.unreadCount - 1),
        items: feed.items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item),
      }));
      try { await notificationApi.markRead(notification.id); } catch { loadNotifications(); }
    }
    setNotificationAnchor(null);
    if (notification.link) navigate(notification.link);
  };

  const markAllNotificationsRead = async () => {
    if (!notificationFeed.unreadCount) return;
    setNotificationFeed((feed) => ({ ...feed, unreadCount: 0, items: feed.items.map((item) => ({ ...item, isRead: true })) }));
    try { await notificationApi.markAllRead(); } catch { loadNotifications(); }
  };

  const handleLogout = async () => {
    setProfileAnchor(null);
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const openSearch = () => { setSearch(''); setSearchOpen(true); };
  const goSearchItem = (item) => { setSearchOpen(false); setSearch(''); navigate(item.path); };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        width: '100%',
        position: 'sticky',
        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(10,11,14,.86)' : 'rgba(250,248,244,.88)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary',
        zIndex: (t) => t.zIndex.drawer + 10,
        pointerEvents: 'auto', isolation: 'isolate',
        '&::before': { content: '""', position: 'absolute', inset: '0 0 auto 0', height: 2, background: 'linear-gradient(90deg, transparent, rgba(242,124,0,.75) 28%, rgba(124,108,255,.70) 70%, transparent)' },
      }}
    >
      <Toolbar sx={{ minHeight: '72px !important', px: { xs: 1.25, sm: 2, md: 2.75 }, gap: 1 }}>
        {isMobile && (
          <motion.div whileTap={{ scale: .92 }}>
            <IconButton onClick={onMenuToggle} sx={actionSx} aria-label={t('common.menu') || 'Menu'}><MenuIcon /></IconButton>
          </motion.div>
        )}

        {!isMobile ? (
          <ButtonBase
            onClick={openSearch}
            sx={{
              flex: '0 1 520px', minWidth: 200, height: 44, px: 1.6, borderRadius: 3.2,
              justifyContent: 'flex-start', gap: 1, color: 'text.secondary',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.72)',
              border: '1px solid', borderColor: 'divider',
              position: 'relative', overflow: 'hidden', transition: 'all 180ms ease',
              '&:hover': { borderColor: 'primary.main', boxShadow: '0 0 0 4px rgba(242,124,0,.06), 0 12px 30px rgba(0,0,0,.08)' },
            }}
          >
            <SearchIcon sx={{ fontSize: 19 }} />
            <Typography variant="body2" sx={{ flex: 1, textAlign: 'left', color: 'text.secondary', fontSize: '.86rem' }}>{t('topbar.searchPlaceholder')}</Typography>
            <Chip icon={<KeyboardCommandKeyRoundedIcon sx={{ fontSize: '13px !important' }} />} label="K" size="small" sx={{ height: 24, borderRadius: 1.6, fontSize: '.65rem', fontWeight: 900 }} />
          </ButtonBase>
        ) : (
          <Tooltip title={t('topbar.search')}><IconButton onClick={openSearch} sx={actionSx} aria-label={t('topbar.search')}><SearchIcon /></IconButton></Tooltip>
        )}

        {!isMobile && (
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={.7} alignItems="center" sx={{ ml: 1 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#2dd47a', boxShadow: '0 0 0 5px rgba(45,212,122,.09)', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 750 }} noWrap>{roleLabel}</Typography>
              <Typography variant="caption" color="text.disabled">·</Typography>
              <Typography variant="caption" color="text.disabled" noWrap>{title}</Typography>
            </Stack>
          </Box>
        )}
        {isMobile && <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1, minWidth: 0, fontSize: '.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>}

        <Stack direction="row" spacing={{ xs: .45, sm: .65 }} alignItems="center">
          <Tooltip title={colorMode === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
            <IconButton onClick={toggleColorMode} sx={actionSx} aria-label={colorMode === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={colorMode} initial={{ rotate: -80, opacity: 0, scale: .7 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 80, opacity: 0, scale: .7 }} transition={{ duration: .2 }} style={{ display: 'flex' }}>
                  {colorMode === 'dark' ? <LightModeIcon sx={{ fontSize: 19 }} /> : <DarkModeIcon sx={{ fontSize: 19 }} />}
                </motion.span>
              </AnimatePresence>
            </IconButton>
          </Tooltip>

          <Tooltip title={t('nav.notifications')}>
            <IconButton onClick={(e) => { setNotificationAnchor(e.currentTarget); loadNotifications(); }} sx={actionSx} aria-label={t('nav.notifications')}>
              <Badge badgeContent={notificationFeed.unreadCount} color="error" max={99}><NotificationsNoneIcon sx={{ fontSize: 19 }} /></Badge>
            </IconButton>
          </Tooltip>

          <LanguageSwitcher variant="icon" />

          <Tooltip title={user?.name || t('common.account')}>
            <ButtonBase
              data-tour={isRecruiter ? 'nav-profile' : undefined}
              onClick={(e) => setProfileAnchor(e.currentTarget)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setProfileAnchor(e.currentTarget); }}
              sx={{
                height: 44, pl: .55, pr: .7, borderRadius: 3.2, display: 'flex', gap: .85,
                bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.72)',
                border: '1px solid', borderColor: profileAnchor ? 'primary.main' : 'divider', transition: 'all 180ms ease',
                '&:hover': { borderColor: 'primary.main', boxShadow: '0 10px 28px rgba(0,0,0,.09)' },
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '.72rem', fontWeight: 900 }}>{getInitials(user?.name)}</Avatar>
              {!isTablet && <Box sx={{ maxWidth: 150, textAlign: 'left' }}><Typography fontWeight={850} fontSize=".78rem" noWrap>{user?.name || t('common.account')}</Typography><Typography variant="caption" color="text.secondary" noWrap>{roleLabel}</Typography></Box>}
              <KeyboardArrowDownIcon sx={{ fontSize: 17, color: 'text.disabled', transform: profileAnchor ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
            </ButtonBase>
          </Tooltip>
        </Stack>
      </Toolbar>

      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        fullWidth maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden', border: '1px solid', borderColor: 'divider', background: (t) => t.palette.mode === 'dark' ? 'rgba(15,17,22,.98)' : 'rgba(255,253,250,.98)', boxShadow: '0 34px 100px rgba(0,0,0,.28)' } }}
      >
        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ p: 2.1, borderBottom: '1px solid', borderColor: 'divider', background: 'linear-gradient(135deg, rgba(242,124,0,.11), rgba(124,108,255,.08))' }}>
            <Stack direction="row" spacing={1.1} alignItems="center">
              <Box sx={{ width: 38, height: 38, borderRadius: 2.3, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: 'action.hover' }}><SearchIcon /></Box>
              <Box sx={{ flex: 1 }}><Typography fontWeight={900}>{t('topbar.quickActions')}</Typography><Typography variant="caption" color="text.secondary">{t('topbar.quickActionsHint')}</Typography></Box>
              <Chip label="ESC" size="small" />
            </Stack>
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, px: 1.2, height: 46, borderRadius: 2.8, bgcolor: 'background.paper', border: '1px solid', borderColor: search ? 'primary.main' : 'divider', boxShadow: search ? '0 0 0 4px rgba(242,124,0,.08)' : 'none' }}>
              <SearchIcon sx={{ color: 'text.disabled' }} />
              <InputBase autoFocus fullWidth value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('topbar.searchPlaceholder')} sx={{ fontSize: '.9rem' }} />
              {search && <Button size="small" onClick={() => setSearch('')} sx={{ minWidth: 0, fontSize: '.7rem' }}>{t('topbar.clear')}</Button>}
            </Box>
          </Box>
          <Box sx={{ maxHeight: 430, overflowY: 'auto', p: 1.1 }}>
            {filteredSearchItems.length ? filteredSearchItems.map((item, index) => {
              const ItemIcon = item.icon;
              return <motion.div key={item.path} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .025 }}>
                <ButtonBase onClick={() => goSearchItem(item)} sx={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', gap: 1.2, px: 1.2, py: 1.05, borderRadius: 2.4, transition: 'all 150ms ease', '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' } }}>
                  <Box sx={{ width: 38, height: 38, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: 'primary.main', flexShrink: 0 }}><ItemIcon sx={{ fontSize: 18 }} /></Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={800} fontSize=".85rem">{t(item.labelKey)}</Typography><Typography variant="caption" color="text.disabled">{item.path}</Typography></Box>
                  <ArrowForwardRoundedIcon sx={{ fontSize: 17, color: 'text.disabled' }} />
                </ButtonBase>
              </motion.div>;
            }) : <Box sx={{ py: 6, textAlign: 'center' }}><SearchIcon sx={{ fontSize: 34, color: 'text.disabled', mb: 1 }} /><Typography fontWeight={850}>{t('topbar.noMatches')}</Typography><Typography variant="body2" color="text.secondary">{t('topbar.tryAnotherSearch')}</Typography></Box>}
          </Box>
          <Box sx={{ px: 2, py: 1.1, borderTop: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between' }}><Typography variant="caption" color="text.disabled">{t('topbar.keyboardHint')}</Typography><Typography variant="caption" color="text.disabled">{roleLabel}</Typography></Box>
        </DialogContent>
      </Dialog>

      <Menu anchorEl={profileAnchor} open={Boolean(profileAnchor)} onClose={() => setProfileAnchor(null)} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} PaperProps={{ elevation: 0, sx: { mt: 1, minWidth: 290, borderRadius: 3.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 22px 70px rgba(0,0,0,.20)', overflow: 'hidden' } }}>
        <Box sx={{ p: 2, background: 'linear-gradient(135deg, rgba(242,124,0,.10), rgba(124,108,255,.07))' }}>
          <Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ width: 46, height: 46, bgcolor: 'primary.main', fontWeight: 900 }}>{getInitials(user?.name)}</Avatar><Box sx={{ minWidth: 0 }}><Typography fontWeight={900} noWrap>{user?.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{user?.email}</Typography><Chip label={roleLabel} size="small" variant="outlined" sx={{ mt: .5, height: 22, fontSize: '.62rem' }} /></Box></Stack>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setProfileAnchor(null); navigate(profilePath); }}><ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>{t('nav.myProfile')}</MenuItem>
        <MenuItem onClick={() => { setProfileAnchor(null); navigate(settingsPath); }}><ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>{t('nav.settings')}</MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}><ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>{t('nav.signOut')}</MenuItem>
      </Menu>

      <Menu anchorEl={notificationAnchor} open={Boolean(notificationAnchor)} onClose={() => setNotificationAnchor(null)} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} transformOrigin={{ horizontal: 'right', vertical: 'top' }} PaperProps={{ elevation: 0, sx: { mt: 1, width: 390, maxWidth: 'calc(100vw - 24px)', borderRadius: 3.5, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 22px 70px rgba(0,0,0,.20)', overflow: 'hidden' } }}>
        <Box sx={{ px: 2, py: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(242,124,0,.09), rgba(124,108,255,.05))' }}><Box><Typography fontWeight={900}>{t('nav.notifications')}</Typography><Typography variant="caption" color="text.secondary">{notificationFeed.unreadCount} {t('topbar.unread')}</Typography></Box>{notificationFeed.unreadCount > 0 && <Button size="small" onClick={markAllNotificationsRead}>{t('common.readAll')}</Button>}</Box>
        <Divider />
        {notificationsLoading ? <Box sx={{ py: 4, display: 'grid', placeItems: 'center' }}><CircularProgress size={22} /></Box> : notificationFeed.items.length ? notificationFeed.items.slice(0, 8).map((notification) => <MenuItem key={notification.id} onClick={() => handleNotificationClick(notification)} sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1.1, bgcolor: notification.isRead ? 'transparent' : 'action.hover' }}><ListItemText primary={notification.title} secondary={notification.message} primaryTypographyProps={{ fontSize: '.82rem', fontWeight: notification.isRead ? 550 : 800 }} secondaryTypographyProps={{ fontSize: '.72rem', sx: { mt: .25, lineHeight: 1.45 } }} /></MenuItem>) : <Box sx={{ py: 4.5, textAlign: 'center' }}><NotificationsNoneIcon sx={{ fontSize: 34, color: 'text.disabled', mb: 1 }} /><Typography fontWeight={800}>{t('common.allCaughtUp')}</Typography></Box>}
        {!isSuperAdmin && <Box sx={{ p: 1 }}><Button fullWidth size="small" variant="outlined" onClick={() => { setNotificationAnchor(null); navigate(isRecruiter ? ROUTES.RECRUITER_NOTIFICATIONS : ROUTES.CANDIDATE_NOTIFICATIONS); }}>{t('common.viewAll')}</Button></Box>}
      </Menu>
    </AppBar>
  );
}
