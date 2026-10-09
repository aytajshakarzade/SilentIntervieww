import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, Chip, Fade, IconButton, Skeleton, Stack,
  Tooltip, Typography,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WorkOutlineRoundedIcon from '@mui/icons-material/WorkOutlineRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import { notificationApi } from '../../api/notificationApi';
import { fmtTimeAgo, fmtDate } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

// Purely presentational: maps a notification's existing `type`/content to an
// icon + accent color. No business logic — falls back gracefully for any
// type value the backend already sends.
function resolveVisual(notification) {
  const type = (notification.type || '').toLowerCase();
  const text = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
  if (type.includes('error') || text.includes('failed') || text.includes('error')) {
    return { icon: ErrorOutlineRoundedIcon, color: '#f1465b' };
  }
  if (type.includes('interview') || text.includes('interview')) {
    return { icon: VideocamRoundedIcon, color: '#F28C28' };
  }
  if (type.includes('application') || text.includes('application') || text.includes('applied')) {
    return { icon: WorkOutlineRoundedIcon, color: '#2E90E5' };
  }
  if (type.includes('complete') || text.includes('completed') || text.includes('approved') || text.includes('accepted')) {
    return { icon: CheckCircleRoundedIcon, color: '#2BBF9C' };
  }
  return { icon: CampaignRoundedIcon, color: '#F5A623' };
}

function dayBucket(dateStr) {
  if (!dateStr) return 'Earlier';
  const date = new Date(dateStr);
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

function NotificationRow({ notification, onClick, t }) {
  const { icon: Icon, color } = resolveVisual(notification);
  const unread = !notification.isRead;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onClick(notification)}
      sx={{
        all: 'unset',
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        p: 1.75,
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: unread ? 'primary.light' : 'divider',
        bgcolor: unread ? 'action.hover' : 'transparent',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 160ms ease, background-color 160ms ease, transform 160ms ease',
        '&:hover': { borderColor: 'primary.main', transform: 'translateX(2px)' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      {unread && (
        <Box sx={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 3,
          background: 'linear-gradient(180deg, #F28C28, #B96313)',
        }} />
      )}
      <Box sx={{
        flexShrink: 0, width: 38, height: 38, borderRadius: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: `${color}18`, color,
      }}>
        <Icon sx={{ fontSize: 19 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography
            variant="body2"
            fontWeight={unread ? 700 : 600}
            sx={{ color: 'text.primary', lineHeight: 1.4 }}
          >
            {notification.title}
          </Typography>
          <Tooltip title={fmtDate(notification.createdAt)}>
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap', flexShrink: 0, mt: 0.2 }}>
              {fmtTimeAgo(notification.createdAt)}
            </Typography>
          </Tooltip>
        </Box>
        {notification.message && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4, lineHeight: 1.55, fontSize: '0.83rem' }}>
            {notification.message}
          </Typography>
        )}
        {unread && (
          <Chip
            label={t('notificationsPage.unread')}
            size="small"
            sx={{
              mt: 1, height: 19, fontSize: '0.62rem', fontWeight: 700,
              bgcolor: 'primary.main', color: '#fff', borderRadius: 1,
            }}
          />
        )}
      </Box>
    </Box>
  );
}

function RowSkeleton() {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, p: 1.75, border: '1px solid', borderColor: 'divider', borderRadius: 2.5 }}>
      <Skeleton variant="rounded" width={38} height={38} sx={{ borderRadius: 2, flexShrink: 0 }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="45%" height={22} />
        <Skeleton variant="text" width="80%" height={18} />
      </Box>
    </Box>
  );
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [feed, setFeed] = useState({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      setFeed(await notificationApi.getMine(50));
    } catch (requestError) {
      setError(requestError?.message || t('notificationsPage.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (notification) => {
    if (!notification.isRead) {
      setFeed((current) => ({
        unreadCount: Math.max(0, current.unreadCount - 1),
        items: current.items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
      }));
      try {
        await notificationApi.markRead(notification.id);
      } catch {
        load();
      }
    }
    if (notification.link) navigate(notification.link);
  };

  const markAll = async () => {
    if (!feed.unreadCount) return;
    setFeed((current) => ({
      unreadCount: 0,
      items: current.items.map((item) => ({ ...item, isRead: true })),
    }));
    try {
      await notificationApi.markAllRead();
    } catch {
      load();
    }
  };

  const BUCKET_LABEL_KEYS = { Today: 'today', Yesterday: 'yesterday', 'This week': 'thisWeek', Earlier: 'earlier' };
  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
    const map = new Map(order.map((key) => [key, []]));
    (feed.items || []).forEach((item) => {
      const bucket = dayBucket(item.createdAt);
      if (!map.has(bucket)) map.set(bucket, []);
      map.get(bucket).push(item);
    });
    return order.filter((key) => map.get(key)?.length).map((key) => [key, map.get(key)]);
  }, [feed.items]);

  return (
    <Box sx={{ maxWidth: 780, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 3 }}>
        <Box>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.03em' }}>
              {t('notificationsPage.title')}
            </Typography>
            {feed.unreadCount > 0 && (
              <Chip
                label={feed.unreadCount}
                size="small"
                sx={{ bgcolor: 'primary.main', color: '#fff', fontWeight: 700, height: 22, borderRadius: 1 }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('notificationsPage.subtitle')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title={t('notificationsPage.refresh')}>
            <span>
              <IconButton
                onClick={() => load(true)}
                disabled={refreshing || loading}
                sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: 2,
                  transition: 'transform 500ms ease',
                  ...(refreshing && { animation: 'spin 700ms linear infinite' }),
                  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
                }}
              >
                <RefreshRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<DoneAllIcon />}
            onClick={markAll}
            disabled={!feed.unreadCount}
          >
            {t('notificationsPage.markAllRead')}
          </Button>
        </Stack>
      </Box>

      {error && (
        <Fade in>
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => load()}>{t('notificationsPage.retry')}</Button>}
            sx={{ mb: 2.5, borderRadius: 2 }}
          >
            {error}
          </Alert>
        </Fade>
      )}

      {loading ? (
        <Stack spacing={1.25}>
          {Array.from({ length: 6 }).map((_, index) => <RowSkeleton key={index} />)}
        </Stack>
      ) : !feed.items?.length ? (
        <Card sx={{ p: 2 }}>
          <EmptyState
            icon={NotificationsNoneRoundedIcon}
            title={t('notificationsPage.allCaughtUp')}
            description={t('notificationsPage.allCaughtUpDescription')}
          />
        </Card>
      ) : (
        <Stack spacing={3}>
          {groups.map(([label, items]) => (
            <Box key={label}>
              <Typography
                variant="overline"
                sx={{ color: 'text.disabled', fontSize: '0.68rem', display: 'block', mb: 1, ml: 0.5 }}
              >
                {t(`notificationsPage.${BUCKET_LABEL_KEYS[label] || 'earlier'}`)}
              </Typography>
              <Stack spacing={1}>
                {items.map((notification) => (
                  <Fade in key={notification.id}>
                    <Box>
                      <NotificationRow notification={notification} onClick={markRead} t={t} />
                    </Box>
                  </Fade>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
